import { db } from "../../services/db";
import { TeamWithScoring } from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

/** Every Copa team with its scoring adjustments in an edition (none recorded = no bonus, no penalty), by name. */
export async function listTeams(editionId: number): Promise<TeamWithScoring[]> {
    const rows = await db("teams as t")
        .leftJoin("edition_team_scoring as s", (join) => join.on("s.team_id", "t.id").andOnVal("s.edition_id", editionId))
        .select("t.id", "t.name", "t.organization_id", "s.bonus_torcida", "s.penalty_points")
        .orderBy("t.name");
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        organization_id: row.organization_id,
        bonus_torcida: Boolean(row.bonus_torcida),
        penalty_points: row.penalty_points ?? 0,
    }));
}

export async function getTeam(id: number, editionId: number): Promise<TeamWithScoring> {
    const team = (await listTeams(editionId)).find((row) => row.id === id);
    if (!team)
        throw new NotFoundError(`Team ${id} not found`);
    return team;
}

export interface TeamScoringInput {
    bonusTorcida?: unknown;
    penaltyPoints?: unknown;
}

/**
 * Updates a team's scoring adjustments in one edition: the supporters ("torcida") bonus flag
 * and/or the penalty points. Fields left out of the input are kept as they are.
 */
export async function setTeamScoring(id: number, editionId: number, input: TeamScoringInput): Promise<TeamWithScoring> {
    const team = await getTeam(id, editionId); // 404 before touching anything
    const next = { bonus_torcida: team.bonus_torcida, penalty_points: team.penalty_points };

    if (input.bonusTorcida !== undefined) {
        if (typeof input.bonusTorcida !== "boolean")
            throw new ValidationError("bonusTorcida must be a boolean");
        next.bonus_torcida = input.bonusTorcida;
    }

    if (input.penaltyPoints !== undefined) {
        if (typeof input.penaltyPoints !== "number" || !Number.isInteger(input.penaltyPoints) || input.penaltyPoints < 0)
            throw new ValidationError("penaltyPoints must be a non-negative integer");
        next.penalty_points = input.penaltyPoints;
    }

    if (input.bonusTorcida === undefined && input.penaltyPoints === undefined)
        throw new ValidationError("Provide bonusTorcida and/or penaltyPoints");

    await db("edition_team_scoring")
        .insert({ edition_id: editionId, team_id: id, ...next })
        .onConflict(["edition_id", "team_id"])
        .merge();
    return getTeam(id, editionId);
}

/** Links a Copa team to its organization (the AAA), so the AAA's sports board can manage its participations. */
export async function setTeamOrganization(id: number, editionId: number, input: { organizationId?: unknown }): Promise<TeamWithScoring> {
    await getTeam(id, editionId);
    const organizationId = input.organizationId === null ? null : Number(input.organizationId);
    if (organizationId !== null) {
        if (!Number.isInteger(organizationId) || !(await db("organizations").where({ id: organizationId }).first()))
            throw new ValidationError("organizationId must be an organization id or null");
    }
    await db("teams").where({ id }).update({ organization_id: organizationId });
    return getTeam(id, editionId);
}
