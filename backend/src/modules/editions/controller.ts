import { Knex } from "knex";
import { db } from "../../services/db";
import type { CopaEdition, Modality } from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

/** SQLite stores booleans as 0/1; make the API shape the same on every database. */
function normalize(edition: CopaEdition): CopaEdition {
    return { ...edition, is_current: Boolean(edition.is_current) };
}

/** Newest first. */
export async function listEditions(): Promise<CopaEdition[]> {
    const rows = await db("copa_editions").select("*").orderBy("year", "desc").orderBy("id", "desc");
    return rows.map(normalize);
}

export async function getEdition(id: number): Promise<CopaEdition> {
    const row = await db("copa_editions").where({ id }).first();
    if (!row) throw new NotFoundError(`Edition ${id} not found`);
    return normalize(row);
}

/**
 * The edition a request refers to: `?edition=<id>` when given, else the current one. Every Copa
 * listing (modalities, matches, standings, time slots, team scoring) is scoped by it.
 */
export async function resolveEditionId(raw: unknown): Promise<number> {
    if (raw !== undefined && raw !== null && raw !== "") {
        const id = Number(raw);
        if (!Number.isInteger(id) || id <= 0) throw new ValidationError("edition must be a positive integer");
        await getEdition(id);
        return id;
    }
    const current = await db("copa_editions").where({ is_current: true }).first();
    if (!current) throw new NotFoundError("No current Copa edition");
    return current.id;
}

function parseName(raw: unknown): string {
    if (typeof raw !== "string" || raw.trim().length === 0) throw new ValidationError("name is required");
    if (raw.trim().length > 60) throw new ValidationError("name must have at most 60 characters");
    return raw.trim();
}

function parseYear(raw: unknown): number {
    const year = Number(raw);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new ValidationError("year must be a valid year");
    return year;
}

async function assertUnique(name: string, year: number, exceptId?: number) {
    const query = db("copa_editions").whereRaw("LOWER(name) = ?", [name.toLowerCase()]).where({ year });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });
    if (await query.first()) throw new ConflictError(`${name} ${year} already exists`);
}

async function makeCurrent(trx: Knex, id: number) {
    await trx("copa_editions").update({ is_current: false });
    await trx("copa_editions").where({ id }).update({ is_current: true });
}

/** A modality code free across every edition: the short code itself when possible, else short + edition id. */
export async function internalModalityCode(trx: Knex, shortCode: string, editionId: number): Promise<string> {
    for (const candidate of [shortCode, `${shortCode}${editionId}`, ...Array.from({ length: 20 }, (_, i) => `${shortCode}${editionId}${String.fromCharCode(65 + i)}`)]) {
        if (!(await trx("modalities").where({ code: candidate }).first())) return candidate;
    }
    throw new ConflictError(`Could not find a free code for ${shortCode}`);
}

export interface CreateEditionInput {
    name?: unknown;
    year?: unknown;
    /** Copy the modalities (names, codes, types; no brackets/results) of this edition. */
    copyModalitiesFrom?: unknown;
    makeCurrent?: unknown;
}

export async function createEdition(input: CreateEditionInput): Promise<CopaEdition> {
    const name = parseName(input.name);
    const year = parseYear(input.year);
    await assertUnique(name, year);

    let source: Modality[] = [];
    if (input.copyModalitiesFrom !== undefined && input.copyModalitiesFrom !== null) {
        const sourceId = Number(input.copyModalitiesFrom);
        await getEdition(sourceId);
        source = await db("modalities").where({ edition_id: sourceId }).orderBy("name");
    }

    const id = await db.transaction(async (trx) => {
        const [row] = await trx("copa_editions").insert({ name, year, is_current: false }).returning("id");
        const editionId: number = typeof row === "object" ? row.id : row;
        for (const modality of source) {
            await trx("modalities").insert({
                code: await internalModalityCode(trx, modality.short_code, editionId),
                short_code: modality.short_code,
                edition_id: editionId,
                name: modality.name,
                type: modality.type,
            });
        }
        if (input.makeCurrent === true) await makeCurrent(trx, editionId);
        return editionId;
    });
    return getEdition(id);
}

/** Body: any of `{ name, year, isCurrent: true }`. An edition stops being current only when another becomes current. */
export async function updateEdition(id: number, input: { name?: unknown; year?: unknown; isCurrent?: unknown }): Promise<CopaEdition> {
    const edition = await getEdition(id);
    const name = input.name === undefined ? edition.name : parseName(input.name);
    const year = input.year === undefined ? edition.year : parseYear(input.year);
    await assertUnique(name, year, id);
    if (input.isCurrent !== undefined && input.isCurrent !== true)
        throw new ValidationError("isCurrent can only be set to true (make another edition current instead)");

    await db.transaction(async (trx) => {
        await trx("copa_editions").where({ id }).update({ name, year });
        if (input.isCurrent === true) await makeCurrent(trx, id);
    });
    return getEdition(id);
}

/** Only an edition without modalities can be deleted, so no bracket or result is lost by accident. */
export async function deleteEdition(id: number): Promise<void> {
    const edition = await getEdition(id);
    if (edition.is_current) throw new ConflictError("The current edition cannot be deleted");
    if (await db("modalities").where({ edition_id: id }).first())
        throw new ConflictError("Delete the modalities of this edition first");
    await db("copa_editions").where({ id }).delete();
}
