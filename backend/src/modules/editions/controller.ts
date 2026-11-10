import { Knex } from "knex";
import { db } from "../../services/db";
import type { CopaEdition, Cup } from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

// --- CUPS ---

/** By name. */
export async function listCups(): Promise<Cup[]> {
    return db("cups").select("*").orderBy("name");
}

async function getCup(id: number): Promise<Cup> {
    const cup = await db("cups").where({ id }).first();
    if (!cup) throw new NotFoundError(`Cup ${id} not found`);
    return cup;
}

function parseName(raw: unknown, field = "name"): string {
    if (typeof raw !== "string" || raw.trim().length === 0) throw new ValidationError(`${field} is required`);
    if (raw.trim().length > 60) throw new ValidationError(`${field} must have at most 60 characters`);
    return raw.trim();
}

async function assertCupNameFree(name: string, exceptId?: number) {
    const query = db("cups").whereRaw("LOWER(name) = ?", [name.toLowerCase()]);
    if (exceptId !== undefined) query.whereNot({ id: exceptId });
    if (await query.first()) throw new ConflictError(`Cup ${name} already exists`);
}

export async function createCup(input: { name?: unknown }): Promise<Cup> {
    const name = parseName(input.name);
    await assertCupNameFree(name);
    const [row] = await db("cups").insert({ name }).returning("id");
    return getCup(typeof row === "object" ? row.id : row);
}

export async function renameCup(id: number, input: { name?: unknown }): Promise<Cup> {
    await getCup(id);
    const name = parseName(input.name);
    await assertCupNameFree(name, id);
    await db("cups").where({ id }).update({ name });
    return getCup(id);
}

/** Only a cup without editions. */
export async function deleteCup(id: number): Promise<void> {
    await getCup(id);
    if (await db("copa_editions").where({ cup_id: id }).first())
        throw new ConflictError("This cup already has editions");
    await db("cups").where({ id }).delete();
}

// --- EDITIONS ---

interface EditionJoinRow {
    id: number;
    cup_id: number;
    cup_name: string;
    year: number;
    custom_name: string | null;
    is_current: boolean | number;
    finished: boolean | number;
}

function editionsQuery(trx: Knex = db) {
    return trx("copa_editions as e")
        .join("cups as c", "c.id", "e.cup_id")
        .select<EditionJoinRow[]>("e.id", "e.cup_id", "c.name as cup_name", "e.year", "e.name as custom_name", "e.is_current", "e.finished");
}

/** SQLite stores booleans as 0/1; make the API shape the same on every database. */
function toEdition(row: EditionJoinRow): CopaEdition {
    return {
        id: row.id,
        cup_id: row.cup_id,
        cup_name: row.cup_name,
        year: row.year,
        name: row.custom_name ?? row.cup_name,
        custom_name: row.custom_name,
        is_current: Boolean(row.is_current),
        finished: Boolean(row.finished),
    };
}

/** Newest first. */
export async function listEditions(filter: { cupId?: number } = {}): Promise<CopaEdition[]> {
    const query = editionsQuery().orderBy("e.year", "desc").orderBy("c.name");
    if (filter.cupId !== undefined) query.where("e.cup_id", filter.cupId);
    return (await query).map(toEdition);
}

export async function getEdition(id: number): Promise<CopaEdition> {
    const row = await editionsQuery().where("e.id", id).first();
    if (!row) throw new NotFoundError(`Edition ${id} not found`);
    return toEdition(row);
}

/**
 * The edition a request refers to: `?edition=<id>` when given, else the current one. Every Copa
 * listing (modalities, matches, standings, time slots, teams) is scoped by it.
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

function parseYear(raw: unknown): number {
    const year = Number(raw);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new ValidationError("year must be a valid year");
    return year;
}

/** null/"" = no custom name (the cup's name is shown). */
function parseCustomName(raw: unknown): string | null {
    if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return null;
    return parseName(raw);
}

async function assertYearFree(cupId: number, year: number, exceptId?: number) {
    const query = db("copa_editions").where({ cup_id: cupId, year });
    if (exceptId !== undefined) query.whereNot({ id: exceptId });
    if (await query.first()) throw new ConflictError("This cup already has an edition in this year");
}

async function makeCurrent(trx: Knex, id: number) {
    await trx("copa_editions").update({ is_current: false });
    await trx("copa_editions").where({ id }).update({ is_current: true });
}

/** The edition a new one copies: the latest of the same cup, else the latest of any cup. */
async function lastEdition(cupId: number): Promise<{ id: number } | undefined> {
    return await db("copa_editions").where({ cup_id: cupId }).orderBy("year", "desc").first("id")
        ?? await db("copa_editions").orderBy("year", "desc").orderBy("id", "desc").first("id");
}

export interface CreateEditionInput {
    cupId?: unknown;
    year?: unknown;
    /** Shown instead of the cup's name (optional). */
    name?: unknown;
    makeCurrent?: unknown;
}

/**
 * A new edition starts with the modalities and participants (with their names) of the last edition
 * of the same cup, or of the latest edition when the cup has none; adjust them afterwards. With no
 * edition at all, it gets every modality and no participants.
 */
export async function createEdition(input: CreateEditionInput): Promise<CopaEdition> {
    const cup = await getCup(Number(input.cupId));
    const year = parseYear(input.year);
    const name = parseCustomName(input.name);
    await assertYearFree(cup.id, year);
    const source = await lastEdition(cup.id);

    const id = await db.transaction(async (trx) => {
        const [row] = await trx("copa_editions").insert({ cup_id: cup.id, year, name, is_current: false, finished: false }).returning("id");
        const editionId: number = typeof row === "object" ? row.id : row;

        const modalities = source
            ? (await trx("edition_modalities").where({ edition_id: source.id }).select("modality_code")).map((m) => m.modality_code)
            : (await trx("modalities").select("code")).map((m) => m.code);
        if (modalities.length > 0)
            await trx("edition_modalities").insert(modalities.map((code) => ({ edition_id: editionId, modality_code: code })));

        const participants = source ? await trx("edition_organizations").where({ edition_id: source.id }).select("organization_id", "display_name") : [];
        if (participants.length > 0)
            await trx("edition_organizations").insert(participants.map((p) => ({ ...p, edition_id: editionId, bonus_torcida: false, penalty_points: 0 })));

        if (input.makeCurrent === true) await makeCurrent(trx, editionId);
        return editionId;
    });
    return getEdition(id);
}

/** Body: any of `{ cupId, year, name, isCurrent: true }`. An edition stops being current only when another becomes current. */
export async function updateEdition(id: number, input: { cupId?: unknown; year?: unknown; name?: unknown; isCurrent?: unknown }): Promise<CopaEdition> {
    const edition = await getEdition(id);
    const cupId = input.cupId === undefined ? edition.cup_id : (await getCup(Number(input.cupId))).id;
    const year = input.year === undefined ? edition.year : parseYear(input.year);
    const name = input.name === undefined ? edition.custom_name : parseCustomName(input.name);
    await assertYearFree(cupId, year, id);
    if (input.isCurrent !== undefined && input.isCurrent !== true)
        throw new ValidationError("isCurrent can only be set to true (make another edition current instead)");

    await db.transaction(async (trx) => {
        await trx("copa_editions").where({ id }).update({ cup_id: cupId, year, name });
        if (input.isCurrent === true) await makeCurrent(trx, id);
    });
    return getEdition(id);
}

/** Tables holding what was played or decided in an edition. */
export const EDITION_DATA_TABLES = ["matches", "registrations", "events", "participations", "edition_results", "modality_results"] as const;

/**
 * Only an edition where nothing was played or logged (no bracket, registration, event,
 * participation or result) can be deleted, so no result is lost by accident. Its modality list,
 * participants and time slots go with it.
 */
export async function deleteEdition(id: number): Promise<void> {
    const edition = await getEdition(id);
    if (edition.is_current) throw new ConflictError("The current edition cannot be deleted");
    for (const table of EDITION_DATA_TABLES) {
        if (await db(table).where({ edition_id: id }).first())
            throw new ConflictError("This edition already has brackets, registrations, events, participations or results");
    }
    await db("copa_editions").where({ id }).delete();
}
