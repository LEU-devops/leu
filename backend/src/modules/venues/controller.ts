import { db } from "../../services/db";
import { Venue } from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export const PATH_SEPARATOR = " > ";

/** A venue with its full path, e.g. "FEF > Complexo de Vôlei > Q1". */
export interface VenueWithPath extends Venue {
    path: string;
}

/** Every venue, with the full path from its root, ordered by path. */
export async function listVenues(): Promise<VenueWithPath[]> {
    const venues = await db("venues").select("*");
    const byId = new Map(venues.map((v) => [v.id, v]));

    function pathOf(venue: Venue): string {
        const parent = venue.parent_id === null ? undefined : byId.get(venue.parent_id);
        return parent ? pathOf(parent) + PATH_SEPARATOR + venue.name : venue.name;
    }

    return venues
        .map((venue) => ({ ...venue, path: pathOf(venue) }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

/** Ids of a venue and every venue nested under it. Useful to filter matches by area. */
export async function venueSubtreeIds(venueId: number): Promise<number[]> {
    const rows = await db
        .withRecursive("subtree", (qb) => {
            qb.select("id").from("venues").where({ id: venueId })
                .unionAll((uqb) => {
                    uqb.select("venues.id").from("venues").join("subtree", "venues.parent_id", "subtree.id");
                });
        })
        .select("id")
        .from("subtree");
    return rows.map((r: { id: number }) => r.id);
}

export async function createVenue(input: { name?: unknown; parentId?: unknown }): Promise<VenueWithPath> {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name)
        throw new ValidationError("name is required");

    let parentId: number | null = null;
    if (input.parentId !== undefined && input.parentId !== null) {
        if (typeof input.parentId !== "number" || !Number.isInteger(input.parentId))
            throw new ValidationError("parentId must be an integer or null");
        const parent = await db("venues").where({ id: input.parentId }).first();
        if (!parent)
            throw new ValidationError(`Parent venue ${input.parentId} not found`);
        parentId = input.parentId;
    }

    const duplicate = await db("venues").where({ name }).andWhere((qb) => {
        if (parentId === null) qb.whereNull("parent_id");
        else qb.where({ parent_id: parentId });
    }).first();
    if (duplicate)
        throw new ConflictError(`Venue "${name}" already exists under the same parent`);

    const [{ id }] = await db("venues").insert({ name, parent_id: parentId }).returning("id");
    const created = (await listVenues()).find((v) => v.id === id)!;
    return created;
}
