import { Knex } from "knex";
import { db } from "../../services/db";
import {
    CatalogModality,
    MAX_BRACKET_TEAMS,
    Match,
    Modality,
    ModalityInEdition,
    ModalityRef,
    MODALITY_TYPES,
    ModalityType,
    Stage,
    STAGES,
} from "../../types/competition";
import { assertTeams } from "../teams/controller";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

// --- MODALITIES ---

/** Modalities of one Copa edition, by name. */
export async function listModalities(editionId: number): Promise<ModalityInEdition[]> {
    return db("edition_modalities as em")
        .join("modalities as m", "m.code", "em.modality_code")
        .where("em.edition_id", editionId)
        .select("m.*", "em.edition_id")
        .orderBy("m.name");
}

/** The whole catalog, by name, each modality with the editions that have it. */
export async function listCatalog(): Promise<CatalogModality[]> {
    const [modalities, links] = await Promise.all([
        db("modalities").select("*").orderBy("name"),
        db("edition_modalities").select("*"),
    ]);
    return modalities.map((modality) => ({
        ...modality,
        edition_ids: links.filter((link) => link.modality_code === modality.code).map((link) => link.edition_id),
    }));
}

export async function getModality(code: string): Promise<Modality | undefined> {
    return db("modalities").where({ code }).first();
}

/** The modality as played in the edition; 404 when the edition does not have it. */
export async function getEditionModality(trx: Knex, { editionId, code }: ModalityRef): Promise<ModalityInEdition> {
    const modality = await trx("edition_modalities as em")
        .join("modalities as m", "m.code", "em.modality_code")
        .where({ "em.edition_id": editionId, "em.modality_code": code })
        .first("m.*", "em.edition_id");
    if (!modality)
        throw new NotFoundError(`Modality ${code} is not part of edition ${editionId}`);
    return modality;
}

/** Tables holding what was played in a modality (per edition). */
const PLAYED_TABLES = ["matches", "registrations", "events", "participations", "modality_results"] as const;

/** Whether the modality has a bracket, registrations, events or Copa participations (in one edition, or in any). */
async function hasPlayedData(code: string, editionId?: number): Promise<boolean> {
    for (const table of PLAYED_TABLES) {
        const query = db(table).where({ modality_code: code });
        if (editionId !== undefined) query.where({ edition_id: editionId });
        if (await query.first()) return true;
    }
    return false;
}

/** A list of modality codes, each of which must exist; used to pick an edition's modalities. */
export async function parseModalityCodes(raw: unknown): Promise<string[]> {
    if (!Array.isArray(raw) || raw.some((code) => typeof code !== "string"))
        throw new ValidationError("modalities must be an array of modality codes");
    const codes = [...new Set((raw as string[]).map((code) => code.trim().toUpperCase()))];
    const known = codes.length > 0 ? await db("modalities").whereIn("code", codes).select("code") : [];
    const missing = codes.filter((code) => !known.some((row) => row.code === code));
    if (missing.length > 0)
        throw new ValidationError(`Modality ${missing.join(", ")} not found`);
    return codes;
}

/**
 * Body: `{ code, name, type, editionIds? }`. `code` is the 2–3 letter code people see ("FM"),
 * the same in every edition. The new modality joins the editions in `editionIds` (default: none).
 */
export async function createModality(input: { code?: unknown; name?: unknown; type?: unknown; editionIds?: unknown }): Promise<CatalogModality> {
    const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const type = input.type;

    if (!/^[A-Z]{2,3}$/.test(code))
        throw new ValidationError("code must have 2 or 3 letters");
    if (!name)
        throw new ValidationError("name is required");
    if (!MODALITY_TYPES.includes(type as ModalityType))
        throw new ValidationError(`type must be one of: ${MODALITY_TYPES.join(", ")}`);
    const editionIds = input.editionIds === undefined ? [] : input.editionIds;
    if (!Array.isArray(editionIds) || editionIds.some((id) => !Number.isInteger(id)))
        throw new ValidationError("editionIds must be an array of edition ids");
    const editions = editionIds.length > 0 ? await db("copa_editions").whereIn("id", editionIds as number[]).select("id") : [];
    if (editions.length !== new Set(editionIds).size)
        throw new ValidationError("Some editions do not exist");

    return db.transaction(async (trx) => {
        if (await trx("modalities").where({ code }).first())
            throw new ConflictError(`Modality ${code} already exists`);
        const modality: Modality = { code, name, type: type as ModalityType };
        await trx("modalities").insert(modality);
        if (editions.length > 0)
            await trx("edition_modalities").insert(editions.map((edition) => ({ edition_id: edition.id, modality_code: code })));
        return { ...modality, edition_ids: editions.map((edition) => edition.id) };
    });
}

/** Removes a modality from the catalog (and every edition). Only when nothing was played in it, in any edition. */
export async function deleteModality(code: string): Promise<void> {
    if (!(await getModality(code)))
        throw new NotFoundError(`Modality ${code} not found`);
    if (await hasPlayedData(code))
        throw new ConflictError("This modality already has a bracket, registrations, events or participations");
    await db("modalities").where({ code }).delete();
}

/** Adds a catalog modality to an edition (no-op when it is already there). */
export async function addModalityToEdition({ editionId, code }: ModalityRef): Promise<void> {
    if (!(await getModality(code)))
        throw new NotFoundError(`Modality ${code} not found`);
    await db("edition_modalities").insert({ edition_id: editionId, modality_code: code }).onConflict(["edition_id", "modality_code"]).ignore();
}

/** Takes a modality out of an edition. Only when nothing was played in it in that edition. */
export async function removeModalityFromEdition({ editionId, code }: ModalityRef): Promise<void> {
    if (await hasPlayedData(code, editionId))
        throw new ConflictError("This modality already has a bracket, registrations, events or participations in this edition");
    await db("edition_modalities").where({ edition_id: editionId, modality_code: code }).delete();
}

// --- BRACKET ---

/** A match row joined with the names (in its edition) of its teams, neutral teams (redator, mesário) and venue. */
export interface BracketMatch extends Match {
    team_a_name: string | null;
    team_b_name: string | null;
    redator_team_name: string | null;
    mesario_team_name: string | null;
    venue_name: string | null;
}

/** The joined columns shared by every match listing. */
export const BRACKET_MATCH_COLUMNS = [
    "m.*",
    "ta.display_name as team_a_name",
    "tb.display_name as team_b_name",
    "tr.display_name as redator_team_name",
    "tm.display_name as mesario_team_name",
    "v.name as venue_name",
];

/** Joins `matches as m` with the names needed by a BracketMatch. */
export function joinBracketMatch(qb: Knex.QueryBuilder) {
    const team = (alias: string, column: string) => (join: Knex.JoinClause) =>
        join.on(`${alias}.organization_id`, `m.${column}`).andOn(`${alias}.edition_id`, "m.edition_id");
    return qb
        .leftJoin("edition_organizations as ta", team("ta", "team_a_id"))
        .leftJoin("edition_organizations as tb", team("tb", "team_b_id"))
        .leftJoin("edition_organizations as tr", team("tr", "redator_team_id"))
        .leftJoin("edition_organizations as tm", team("tm", "mesario_team_id"))
        .leftJoin("venues as v", "v.id", "m.venue_id");
}

/** SQLite stores booleans as 0/1; make the API shape the same on every database. */
export function normalizeMatch<T extends Match>(match: T): T {
    return { ...match, walkover: Boolean(match.walkover) };
}

export async function getBracket({ editionId, code }: ModalityRef): Promise<BracketMatch[]> {
    const rows: BracketMatch[] = await joinBracketMatch(db("matches as m"))
        .select(BRACKET_MATCH_COLUMNS)
        .where({ "m.edition_id": editionId, "m.modality_code": code })
        .orderBy([{ column: "m.round" }, { column: "m.position" }]);
    return rows.map(normalizeMatch);
}

/**
 * Parses the first-round slots of a bracket: an array whose length is the bracket size (2, 4, 8
 * or 16) of team ids (organization ids of the edition's teams). Slots 2k and 2k+1 form first-round
 * match k. A `null` slot means its opponent has a bye and goes straight to round 2.
 */
function parseSlots(input: unknown): (number | null)[] {
    if (!Array.isArray(input))
        throw new ValidationError("slots must be an array of team ids (null for an empty slot)");

    const size = input.length;
    if (size < 2 || size > MAX_BRACKET_TEAMS || (size & (size - 1)) !== 0)
        throw new ValidationError(`slots length must be a power of two between 2 and ${MAX_BRACKET_TEAMS}`);

    if (input.some((slot) => slot !== null && (typeof slot !== "number" || !Number.isInteger(slot))))
        throw new ValidationError("every slot must be a team id or null");
    const slots = input as (number | null)[];

    const ids = slots.filter((slot): slot is number => slot !== null);
    if (ids.length < 2)
        throw new ValidationError("a bracket needs at least 2 teams");
    if (new Set(ids).size !== ids.length)
        throw new ValidationError("a team appears twice");

    for (let match = 0; match < size / 2; match++) {
        if (slots[2 * match] === null && slots[2 * match + 1] === null)
            throw new ValidationError(`first-round match ${match} has no teams`);
    }

    return slots;
}

/** Stage label of a round, counted from the final backwards (final, sf, qf, r16). */
function stageOf(round: number, totalRounds: number): Stage {
    const fromEnd = totalRounds - round;
    const stage = [...STAGES].reverse()[fromEnd];
    if (!stage)
        throw new ValidationError(`bracket too large: ${totalRounds} rounds`);
    return stage;
}

/**
 * Creates a single-elimination bracket for a modality of an edition from its first-round slots
 * (team ids; every team must play the edition).
 *
 * A first-round match with an empty slot is a bye: the match is not created and
 * its team is placed directly in the corresponding round-2 slot. Which matches
 * get a bye is up to the caller (the frontend spreads them evenly).
 */
export async function createBracket(ref: ModalityRef, slotsInput: unknown): Promise<BracketMatch[]> {
    const slots = parseSlots(slotsInput);
    const modalityCode = ref.code;

    const modality = await getEditionModality(db, ref);
    if (modality.type !== "chaveamento")
        throw new ValidationError(`Modality ${modalityCode} is not of type chaveamento`);

    const size = slots.length;
    const totalRounds = Math.log2(size);

    await db.transaction(async (trx) => {
        const existing = await trx("matches").where({ edition_id: ref.editionId, modality_code: modalityCode }).first();
        if (existing)
            throw new ConflictError(`Modality ${modalityCode} already has a bracket`);

        await assertTeams(trx, ref.editionId, slots);

        async function insertMatch(round: number, position: number, nextIds: number[] | undefined, extra: Partial<Match> = {}) {
            const [{ id }] = await trx("matches")
                .insert({
                    edition_id: ref.editionId,
                    modality_code: modalityCode,
                    stage: stageOf(round, totalRounds),
                    round,
                    position,
                    next_match_id: nextIds ? nextIds[Math.floor(position / 2)] : null,
                    next_slot: nextIds ? (position % 2 === 0 ? "a" : "b") : null,
                    ...extra,
                })
                .returning("id");
            return id as number;
        }

        // Rounds 2..final are created empty, from the final backwards so each match knows its next_match_id.
        const idsByRound: number[][] = [];
        for (let round = totalRounds; round >= 2; round--) {
            const ids: number[] = [];
            for (let position = 0; position < size / 2 ** round; position++)
                ids.push(await insertMatch(round, position, idsByRound[round + 1]));
            idsByRound[round] = ids;
        }

        // First round: real matches get created, byes go straight into round 2.
        const nextIds = idsByRound[2];
        for (let position = 0; position < size / 2; position++) {
            const a = slots[2 * position];
            const b = slots[2 * position + 1];
            if (a !== null && b !== null) {
                await insertMatch(1, position, nextIds, { team_a_id: a, team_b_id: b });
                continue;
            }

            const slot = position % 2 === 0 ? "team_a_id" : "team_b_id";
            await trx("matches").where({ id: nextIds[Math.floor(position / 2)] }).update({ [slot]: a ?? b });
        }
    });

    return getBracket(ref);
}

// --- RESULTS ---

async function findMatch(trx: Knex, { editionId, code }: ModalityRef, matchId: number): Promise<Match> {
    const match = await trx("matches").where({ id: matchId, edition_id: editionId, modality_code: code }).first();
    if (!match)
        throw new ValidationError(`Match ${matchId} not found in modality ${code}`);
    return match;
}

/** A result can only be changed or cleared while the match it feeds is still unresolved. */
async function assertNextMatchUnresolved(trx: Knex, match: Match) {
    if (match.next_match_id === null)
        return;
    const next = await trx("matches").where({ id: match.next_match_id }).first();
    if (next && next.winner_id !== null)
        throw new ConflictError("The next match already has a result; clear it first");
}

function parseScore(value: unknown, field: string): string | null {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== "string")
        throw new ValidationError(`${field} must be a string`);
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

export interface MatchResultInput {
    scoreA?: unknown;
    scoreB?: unknown;
    winner?: unknown;
    walkover?: unknown;
}

/**
 * Sets (or replaces) the result of a match and places the winner in the next match.
 * Scores are free text so shootouts can be written as the organizers like; a walkover (WO)
 * is flagged separately so the scoring rules can tell it apart from a played match.
 */
export async function setMatchResult(ref: ModalityRef, matchId: number, input: MatchResultInput): Promise<BracketMatch[]> {
    const scoreA = parseScore(input.scoreA, "scoreA");
    const scoreB = parseScore(input.scoreB, "scoreB");
    if (input.winner !== "a" && input.winner !== "b")
        throw new ValidationError('winner must be "a" or "b"');
    if (input.walkover !== undefined && typeof input.walkover !== "boolean")
        throw new ValidationError("walkover must be a boolean");
    const walkover = input.walkover === true;

    await db.transaction(async (trx) => {
        const match = await findMatch(trx, ref, matchId);
        if (match.team_a_id === null || match.team_b_id === null)
            throw new ValidationError("Both teams must be defined before setting a result");

        await assertNextMatchUnresolved(trx, match);

        const winnerId = input.winner === "a" ? match.team_a_id : match.team_b_id;
        await trx("matches")
            .where({ id: match.id })
            .update({ score_a: scoreA, score_b: scoreB, winner_id: winnerId, walkover, status: "finished" });

        if (match.next_match_id !== null && match.next_slot !== null) {
            const slot = match.next_slot === "a" ? "team_a_id" : "team_b_id";
            await trx("matches").where({ id: match.next_match_id }).update({ [slot]: winnerId });
        }
    });

    return getBracket(ref);
}

/** Clears the result of a match and removes its winner from the next match. */
export async function clearMatchResult(ref: ModalityRef, matchId: number): Promise<BracketMatch[]> {
    await db.transaction(async (trx) => {
        const match = await findMatch(trx, ref, matchId);
        if (match.winner_id === null)
            throw new ValidationError("Match has no result to clear");

        await assertNextMatchUnresolved(trx, match);

        await trx("matches")
            .where({ id: match.id })
            .update({ score_a: null, score_b: null, winner_id: null, walkover: false, status: "scheduled" });

        if (match.next_match_id !== null && match.next_slot !== null) {
            const slot = match.next_slot === "a" ? "team_a_id" : "team_b_id";
            await trx("matches").where({ id: match.next_match_id }).update({ [slot]: null });
        }
    });

    return getBracket(ref);
}

// --- SCHEDULE ---

export interface MatchScheduleInput {
    scheduledAt?: unknown;
    venueId?: unknown;
    redatorTeamId?: unknown;
    mesarioTeamId?: unknown;
}

/** An optional integer id; null/undefined clears the field. */
function parseOptionalId(value: unknown, field: string): number | null {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== "number" || !Number.isInteger(value))
        throw new ValidationError(`${field} must be an integer or null`);
    return value;
}

/** Sets when and where a match happens and which teams are its neutrals (redator, mesário). Each field can be null to clear it. */
export async function setMatchSchedule(ref: ModalityRef, matchId: number, input: MatchScheduleInput): Promise<BracketMatch[]> {
    let scheduledAt: string | null = null;
    if (input.scheduledAt !== null && input.scheduledAt !== undefined) {
        const date = typeof input.scheduledAt === "string" ? new Date(input.scheduledAt) : new Date(NaN);
        if (Number.isNaN(date.getTime()))
            throw new ValidationError("scheduledAt must be an ISO 8601 date string or null");
        scheduledAt = date.toISOString();
    }

    const venueId = parseOptionalId(input.venueId, "venueId");
    const redatorTeamId = parseOptionalId(input.redatorTeamId, "redatorTeamId");
    const mesarioTeamId = parseOptionalId(input.mesarioTeamId, "mesarioTeamId");
    if (venueId !== null && !(await db("venues").where({ id: venueId }).first()))
        throw new ValidationError(`Venue ${venueId} not found`);

    await db.transaction(async (trx) => {
        await assertTeams(trx, ref.editionId, [redatorTeamId, mesarioTeamId]);
        const match = await findMatch(trx, ref, matchId);
        for (const [role, teamId] of [["redator", redatorTeamId], ["mesário", mesarioTeamId]] as const) {
            if (teamId !== null && (teamId === match.team_a_id || teamId === match.team_b_id))
                throw new ValidationError(`The ${role} team cannot be one of the teams playing`);
        }
        await trx("matches")
            .where({ id: match.id })
            .update({ scheduled_at: scheduledAt, venue_id: venueId, redator_team_id: redatorTeamId, mesario_team_id: mesarioTeamId });
    });

    return getBracket(ref);
}
