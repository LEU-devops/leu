import { db } from "../../services/db";
import { Team } from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

/** SQLite stores booleans as 0/1; make the API shape the same on every database. */
function normalizeTeam(team: Team): Team {
    return { ...team, bonus_torcida: Boolean(team.bonus_torcida) };
}

/** Every team, with its scoring adjustments, ordered by name. */
export async function listTeams(): Promise<Team[]> {
    const teams = await db("teams").select("*").orderBy("name");
    return teams.map(normalizeTeam);
}

export async function getTeam(id: number): Promise<Team> {
    const team = await db("teams").where({ id }).first();
    if (!team)
        throw new NotFoundError(`Team ${id} not found`);
    return normalizeTeam(team);
}

export interface TeamScoringInput {
    bonusTorcida?: unknown;
    penaltyPoints?: unknown;
}

/**
 * Updates a team's scoring adjustments: the supporters ("torcida") bonus flag and/or the
 * penalty points. Fields left out of the input are kept as they are.
 */
export async function setTeamScoring(id: number, input: TeamScoringInput): Promise<Team> {
    const changes: Partial<Pick<Team, "bonus_torcida" | "penalty_points">> = {};

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
        throw new ValidationError("Provide bonusTorcida and/or penaltyPoints");

    await getTeam(id); // 404 before touching anything
    await db("teams").where({ id }).update(changes);
    return getTeam(id);
}
