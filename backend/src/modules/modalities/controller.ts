import { Knex } from "knex";
import { db } from "../../services/db";
import {
    MAX_BRACKET_TEAMS,
    Match,
    Modality,
    MODALITY_TYPES,
    ModalityType,
    Stage,
    STAGES,
    Team,
} from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

// --- MODALITIES ---

export async function listModalities(): Promise<Modality[]> {
    return db("modalities").select("*").orderBy("name");
}

export async function getModality(code: string): Promise<Modality | undefined> {
    return db("modalities").where({ code }).first();
}

export async function createModality(input: { code?: unknown; name?: unknown; type?: unknown }): Promise<Modality> {
    const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const type = input.type;

    if (!/^[A-Z]{2}$/.test(code))
        throw new ValidationError("code must be exactly 2 letters");
    if (!name)
        throw new ValidationError("name is required");
    if (!MODALITY_TYPES.includes(type as ModalityType))
        throw new ValidationError(`type must be one of: ${MODALITY_TYPES.join(", ")}`);

    if (await getModality(code))
        throw new ConflictError(`Modality ${code} already exists`);

    const modality: Modality = { code, name, type: type as ModalityType };
    await db("modalities").insert(modality);
    return modality;
}

// --- BRACKET ---

/** A match row joined with the names of its teams and venue. */
export interface BracketMatch extends Match {
    team_a_name: string | null;
    team_b_name: string | null;
    venue_name: string | null;
}

export async function getBracket(modalityCode: string): Promise<BracketMatch[]> {
    return db("matches as m")
        .leftJoin("teams as ta", "ta.id", "m.team_a_id")
        .leftJoin("teams as tb", "tb.id", "m.team_b_id")
        .leftJoin("venues as v", "v.id", "m.venue_id")
        .select("m.*", "ta.name as team_a_name", "tb.name as team_b_name", "v.name as venue_name")
        .where("m.modality_code", modalityCode)
        .orderBy([{ column: "m.round" }, { column: "m.position" }]);
}

/**
 * Parses the first-round slots of a bracket: an array whose length is the
 * bracket size (2, 4, 8 or 16). Slots 2k and 2k+1 form first-round match k.
 * A `null` slot means its opponent has a bye and goes straight to round 2.
 */
function parseSlots(input: unknown): (string | null)[] {
    if (!Array.isArray(input))
        throw new ValidationError("slots must be an array of team names (null for an empty slot)");

    const size = input.length;
    if (size < 2 || size > MAX_BRACKET_TEAMS || (size & (size - 1)) !== 0)
        throw new ValidationError(`slots length must be a power of two between 2 and ${MAX_BRACKET_TEAMS}`);

    const slots = input.map((s) => (s === null ? null : typeof s === "string" ? s.trim() : ""));
    if (slots.some((s) => s === ""))
        throw new ValidationError("every slot must be a non-empty team name or null");

    const names = slots.filter((s): s is string => s !== null);
    if (names.length < 2)
        throw new ValidationError("a bracket needs at least 2 teams");

    const seen = new Set<string>();
    for (const n of names) {
        const key = n.toLowerCase();
        if (seen.has(key))
            throw new ValidationError(`duplicate team name: ${n}`);
        seen.add(key);
    }

    for (let match = 0; match < size / 2; match++) {
        if (slots[2 * match] === null && slots[2 * match + 1] === null)
            throw new ValidationError(`first-round match ${match} has no teams`);
    }

    return slots;
}

/** Finds teams by name, creating the ones that do not exist yet. Keeps the input order. */
async function findOrCreateTeams(trx: Knex.Transaction, names: string[]): Promise<Team[]> {
    const existing = await trx("teams").whereIn("name", names);
    const byName = new Map(existing.map((t) => [t.name, t]));

    const teams: Team[] = [];
    for (const name of names) {
        const found = byName.get(name);
        if (found) {
            teams.push(found);
            continue;
        }
        const [{ id }] = await trx("teams").insert({ name }).returning("id");
        teams.push({ id, name });
    }
    return teams;
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
 * Creates a single-elimination bracket for a modality from its first-round slots.
 *
 * A first-round match with an empty slot is a bye: the match is not created and
 * its team is placed directly in the corresponding round-2 slot. Which matches
 * get a bye is up to the caller (the frontend spreads them evenly).
 */
export async function createBracket(modalityCode: string, slotsInput: unknown): Promise<BracketMatch[]> {
    const slots = parseSlots(slotsInput);

    const modality = await getModality(modalityCode);
    if (!modality)
        throw new ValidationError(`Modality ${modalityCode} not found`);
    if (modality.type !== "chaveamento")
        throw new ValidationError(`Modality ${modalityCode} is not of type chaveamento`);

    const size = slots.length;
    const totalRounds = Math.log2(size);

    await db.transaction(async (trx) => {
        const existing = await trx("matches").where({ modality_code: modalityCode }).first();
        if (existing)
            throw new ConflictError(`Modality ${modalityCode} already has a bracket`);

        const names = slots.filter((s): s is string => s !== null);
        const teams = await findOrCreateTeams(trx, names);
        const teamByName = new Map(teams.map((t) => [t.name, t]));

        async function insertMatch(round: number, position: number, nextIds: number[] | undefined, extra: Partial<Match> = {}) {
            const [{ id }] = await trx("matches")
                .insert({
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
            const teamA = a === null ? null : teamByName.get(a)!;
            const teamB = b === null ? null : teamByName.get(b)!;

            if (teamA && teamB) {
                await insertMatch(1, position, nextIds, { team_a_id: teamA.id, team_b_id: teamB.id });
                continue;
            }

            const byeTeam = (teamA ?? teamB)!;
            const slot = position % 2 === 0 ? "team_a_id" : "team_b_id";
            await trx("matches").where({ id: nextIds[Math.floor(position / 2)] }).update({ [slot]: byeTeam.id });
        }
    });

    return getBracket(modalityCode);
}

// --- RESULTS ---

async function findMatch(trx: Knex, modalityCode: string, matchId: number): Promise<Match> {
    const match = await trx("matches").where({ id: matchId, modality_code: modalityCode }).first();
    if (!match)
        throw new ValidationError(`Match ${matchId} not found in modality ${modalityCode}`);
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
}

/**
 * Sets (or replaces) the result of a match and places the winner in the next match.
 * Scores are free text so shootouts and walkovers can be written as the organizers like.
 */
export async function setMatchResult(modalityCode: string, matchId: number, input: MatchResultInput): Promise<BracketMatch[]> {
    const scoreA = parseScore(input.scoreA, "scoreA");
    const scoreB = parseScore(input.scoreB, "scoreB");
    if (input.winner !== "a" && input.winner !== "b")
        throw new ValidationError('winner must be "a" or "b"');

    await db.transaction(async (trx) => {
        const match = await findMatch(trx, modalityCode, matchId);
        if (match.team_a_id === null || match.team_b_id === null)
            throw new ValidationError("Both teams must be defined before setting a result");

        await assertNextMatchUnresolved(trx, match);

        const winnerId = input.winner === "a" ? match.team_a_id : match.team_b_id;
        await trx("matches")
            .where({ id: match.id })
            .update({ score_a: scoreA, score_b: scoreB, winner_id: winnerId, status: "finished" });

        if (match.next_match_id !== null && match.next_slot !== null) {
            const slot = match.next_slot === "a" ? "team_a_id" : "team_b_id";
            await trx("matches").where({ id: match.next_match_id }).update({ [slot]: winnerId });
        }
    });

    return getBracket(modalityCode);
}

/** Clears the result of a match and removes its winner from the next match. */
export async function clearMatchResult(modalityCode: string, matchId: number): Promise<BracketMatch[]> {
    await db.transaction(async (trx) => {
        const match = await findMatch(trx, modalityCode, matchId);
        if (match.winner_id === null)
            throw new ValidationError("Match has no result to clear");

        await assertNextMatchUnresolved(trx, match);

        await trx("matches")
            .where({ id: match.id })
            .update({ score_a: null, score_b: null, winner_id: null, status: "scheduled" });

        if (match.next_match_id !== null && match.next_slot !== null) {
            const slot = match.next_slot === "a" ? "team_a_id" : "team_b_id";
            await trx("matches").where({ id: match.next_match_id }).update({ [slot]: null });
        }
    });

    return getBracket(modalityCode);
}

// --- SCHEDULE ---

export interface MatchScheduleInput {
    scheduledAt?: unknown;
    venueId?: unknown;
}

/** Sets when and where a match happens. Either field can be null to clear it. */
export async function setMatchSchedule(modalityCode: string, matchId: number, input: MatchScheduleInput): Promise<BracketMatch[]> {
    let scheduledAt: string | null = null;
    if (input.scheduledAt !== null && input.scheduledAt !== undefined) {
        const date = typeof input.scheduledAt === "string" ? new Date(input.scheduledAt) : new Date(NaN);
        if (Number.isNaN(date.getTime()))
            throw new ValidationError("scheduledAt must be an ISO 8601 date string or null");
        scheduledAt = date.toISOString();
    }

    let venueId: number | null = null;
    if (input.venueId !== null && input.venueId !== undefined) {
        if (typeof input.venueId !== "number" || !Number.isInteger(input.venueId))
            throw new ValidationError("venueId must be an integer or null");
        const venue = await db("venues").where({ id: input.venueId }).first();
        if (!venue)
            throw new ValidationError(`Venue ${input.venueId} not found`);
        venueId = input.venueId;
    }

    await db.transaction(async (trx) => {
        const match = await findMatch(trx, modalityCode, matchId);
        await trx("matches").where({ id: match.id }).update({ scheduled_at: scheduledAt, venue_id: venueId });
    });

    return getBracket(modalityCode);
}
