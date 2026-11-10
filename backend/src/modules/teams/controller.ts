import { Knex } from "knex";
import { db } from "../../services/db";
import type { Team } from "../../types/competition";

/**
 * The teams of an edition: the organizations that play it, each with the name it shows there and
 * its scoring adjustments. A team's id is its organization id.
 */

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

interface TeamRow {
    organization_id: number;
    display_name: string;
    organization_name: string;
    bonus_torcida: boolean | number;
    penalty_points: number;
}

function toTeam(row: TeamRow): Team {
    return {
        id: row.organization_id,
        name: row.display_name,
        organization_name: row.organization_name,
        bonus_torcida: Boolean(row.bonus_torcida),
        penalty_points: row.penalty_points,
    };
}

function teamsQuery(trx: Knex, editionId: number) {
    return trx("edition_organizations as eo")
        .join("organizations as o", "o.id", "eo.organization_id")
        .where("eo.edition_id", editionId)
        .select<TeamRow[]>("eo.organization_id", "eo.display_name", "o.name as organization_name", "eo.bonus_torcida", "eo.penalty_points");
}

/** By name. */
export async function listTeams(editionId: number): Promise<Team[]> {
    return (await teamsQuery(db, editionId).orderBy("eo.display_name")).map(toTeam);
}

export async function getTeam(editionId: number, organizationId: number, trx: Knex = db): Promise<Team> {
    const row = await teamsQuery(trx, editionId).where("eo.organization_id", organizationId).first();
    if (!row) throw new NotFoundError(`Organization ${organizationId} does not play edition ${editionId}`);
    return toTeam(row);
}

/** Throws unless every id is a team of the edition (null entries are ignored). */
export async function assertTeams(trx: Knex, editionId: number, ids: (number | null)[], field = "team"): Promise<void> {
    const wanted = [...new Set(ids.filter((id): id is number => id !== null))];
    if (wanted.length === 0) return;
    const found = await trx("edition_organizations").where({ edition_id: editionId }).whereIn("organization_id", wanted).select("organization_id");
    const missing = wanted.filter((id) => !found.some((row) => row.organization_id === id));
    if (missing.length > 0)
        throw new ValidationError(`${field} ${missing.join(", ")} ${missing.length > 1 ? "do" : "does"} not play this edition`);
}

function parseDisplayName(raw: unknown): string {
    if (typeof raw !== "string" || raw.trim().length === 0) throw new ValidationError("displayName is required");
    if (raw.trim().length > 40) throw new ValidationError("displayName must have at most 40 characters");
    return raw.trim();
}

async function assertNameFree(editionId: number, name: string, exceptOrganizationId: number) {
    const clash = await db("edition_organizations")
        .where({ edition_id: editionId })
        .whereNot({ organization_id: exceptOrganizationId })
        .whereRaw("LOWER(display_name) = ?", [name.toLowerCase()])
        .first();
    if (clash) throw new ConflictError(`Another team is already called ${name} in this edition`);
}

/** Body: `{ organizationId, displayName? }` (default: the organization's short name, else its name). */
export async function addTeam(editionId: number, input: { organizationId?: unknown; displayName?: unknown }): Promise<Team> {
    const organizationId = Number(input.organizationId);
    const organization = Number.isInteger(organizationId) ? await db("organizations").where({ id: organizationId }).first() : undefined;
    if (!organization) throw new ValidationError("organizationId must be an organization");
    if (await db("edition_organizations").where({ edition_id: editionId, organization_id: organizationId }).first())
        throw new ConflictError(`${organization.name} already plays this edition`);
    const displayName = input.displayName === undefined || input.displayName === null || input.displayName === ""
        ? (organization.short_name ?? organization.name) as string
        : parseDisplayName(input.displayName);
    await assertNameFree(editionId, displayName, organizationId);
    await db("edition_organizations").insert({ edition_id: editionId, organization_id: organizationId, display_name: displayName, bonus_torcida: false, penalty_points: 0 });
    return getTeam(editionId, organizationId);
}

export interface TeamUpdateInput {
    displayName?: unknown;
    bonusTorcida?: unknown;
    penaltyPoints?: unknown;
}

/**
 * Updates a team's name in the edition and/or its scoring adjustments: the supporters ("torcida")
 * bonus flag and the penalty points. Fields left out keep their value.
 */
export async function updateTeam(editionId: number, organizationId: number, input: TeamUpdateInput): Promise<Team> {
    await getTeam(editionId, organizationId); // 404 before touching anything
    const changes: Partial<{ display_name: string; bonus_torcida: boolean; penalty_points: number }> = {};

    if (input.displayName !== undefined) {
        changes.display_name = parseDisplayName(input.displayName);
        await assertNameFree(editionId, changes.display_name, organizationId);
    }
    if (input.bonusTorcida !== undefined) {
        if (typeof input.bonusTorcida !== "boolean")
            throw new ValidationError("bonusTorcida must be a boolean");
        changes.bonus_torcida = input.bonusTorcida;
    }
    if (input.penaltyPoints !== undefined) {
        if (typeof input.penaltyPoints !== "number" || !Number.isInteger(input.penaltyPoints) || input.penaltyPoints < 0)
            throw new ValidationError("penaltyPoints must be a non-negative integer");
        changes.penalty_points = input.penaltyPoints;
    }
    if (Object.keys(changes).length === 0)
        throw new ValidationError("Provide displayName, bonusTorcida and/or penaltyPoints");

    await db("edition_organizations").where({ edition_id: editionId, organization_id: organizationId }).update(changes);
    return getTeam(editionId, organizationId);
}

/** Only a team that has not played or been ranked in the edition. */
export async function removeTeam(editionId: number, organizationId: number): Promise<void> {
    await getTeam(editionId, organizationId);
    const played = await db("matches")
        .where({ edition_id: editionId })
        .where((q) => q.where({ team_a_id: organizationId }).orWhere({ team_b_id: organizationId })
            .orWhere({ redator_team_id: organizationId }).orWhere({ mesario_team_id: organizationId }))
        .first()
        ?? await db("event_results as r").join("events as e", "e.id", "r.event_id").where({ "e.edition_id": editionId, "r.team_id": organizationId }).first()
        ?? await db("registrations").where({ edition_id: editionId, team_id: organizationId }).first();
    if (played) throw new ConflictError("This team already plays in a bracket, registration or event of this edition");
    for (const table of ["participations", "edition_results", "modality_results"] as const) {
        if (await db(table).where({ edition_id: editionId, organization_id: organizationId }).first())
            throw new ConflictError("This team already has participations or results in this edition");
    }
    await db("edition_organizations").where({ edition_id: editionId, organization_id: organizationId }).delete();
}
