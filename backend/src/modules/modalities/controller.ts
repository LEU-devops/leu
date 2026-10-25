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

/** A match row joined with the names of the teams in it. */
export interface BracketMatch extends Match {
    team_a_name: string | null;
    team_b_name: string | null;
}

export async function getBracket(modalityCode: string): Promise<BracketMatch[]> {
    return db("matches as m")
        .leftJoin("teams as ta", "ta.id", "m.team_a_id")
        .leftJoin("teams as tb", "tb.id", "m.team_b_id")
        .select("m.*", "ta.name as team_a_name", "tb.name as team_b_name")
        .where("m.modality_code", modalityCode)
        .orderBy([{ column: "m.round" }, { column: "m.position" }]);
}

function parseTeamNames(input: unknown): string[] {
    if (!Array.isArray(input))
        throw new ValidationError("teams must be an array of names");

    const names = input.map((n) => (typeof n === "string" ? n.trim() : ""));
    if (names.some((n) => !n))
        throw new ValidationError("every team name must be a non-empty string");

    if (names.length < 2 || names.length > MAX_BRACKET_TEAMS)
        throw new ValidationError(`teams must have between 2 and ${MAX_BRACKET_TEAMS} names`);

    const seen = new Set<string>();
    for (const n of names) {
        const key = n.toLowerCase();
        if (seen.has(key))
            throw new ValidationError(`duplicate team name: ${n}`);
        seen.add(key);
    }
    return names;
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
 * Creates a single-elimination bracket for a modality.
 *
 * The bracket has the smallest power-of-two size that fits the teams. When the
 * number of teams is not a power of two, the first teams of the list get a bye:
 * their first-round match is a walkover and they are placed directly in the
 * next round. Teams fill the bracket top to bottom in the order given.
 */
export async function createBracket(modalityCode: string, teamsInput: unknown): Promise<BracketMatch[]> {
    const names = parseTeamNames(teamsInput);

    const modality = await getModality(modalityCode);
    if (!modality)
        throw new ValidationError(`Modality ${modalityCode} not found`);
    if (modality.type !== "chaveamento")
        throw new ValidationError(`Modality ${modalityCode} is not of type chaveamento`);

    const size = 2 ** Math.ceil(Math.log2(names.length));
    const totalRounds = Math.log2(size);
    const byes = size - names.length;

    await db.transaction(async (trx) => {
        const existing = await trx("matches").where({ modality_code: modalityCode }).first();
        if (existing)
            throw new ConflictError(`Modality ${modalityCode} already has a bracket`);

        const teams = await findOrCreateTeams(trx, names);

        // Create rounds from the final backwards so each match knows its next_match_id.
        const idsByRound: number[][] = [];
        for (let round = totalRounds; round >= 1; round--) {
            const matchesInRound = size / 2 ** round;
            const nextIds = idsByRound[round + 1];
            const ids: number[] = [];

            for (let position = 0; position < matchesInRound; position++) {
                const [{ id }] = await trx("matches")
                    .insert({
                        modality_code: modalityCode,
                        stage: stageOf(round, totalRounds),
                        round,
                        position,
                        next_match_id: nextIds ? nextIds[Math.floor(position / 2)] : null,
                        next_slot: nextIds ? (position % 2 === 0 ? "a" : "b") : null,
                    })
                    .returning("id");
                ids.push(id);
            }
            idsByRound[round] = ids;
        }

        // Fill the first round. The first `byes` teams get a match alone (walkover),
        // the remaining teams are paired in order.
        const firstRound = idsByRound[1];
        let teamIndex = 0;

        for (let position = 0; position < firstRound.length; position++) {
            const matchId = firstRound[position];
            const isBye = position < byes;

            const teamA = teams[teamIndex++];
            const teamB = isBye ? null : teams[teamIndex++];

            await trx("matches")
                .where({ id: matchId })
                .update({
                    team_a_id: teamA.id,
                    team_b_id: teamB?.id ?? null,
                    winner_id: isBye ? teamA.id : null,
                    status: isBye ? "walkover" : "scheduled",
                });

            if (isBye && totalRounds > 1) {
                const nextId = idsByRound[2][Math.floor(position / 2)];
                const slot = position % 2 === 0 ? "team_a_id" : "team_b_id";
                await trx("matches").where({ id: nextId }).update({ [slot]: teamA.id });
            }
        }
    });

    return getBracket(modalityCode);
}
