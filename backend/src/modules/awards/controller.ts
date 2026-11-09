import { db } from "../../services/db";
import {
    assertCanManageSports,
    NotFoundError,
    organizationSummaries,
    OrganizationSummary,
    ValidationError,
} from "../organizations/controller";
import { AWARD_KINDS, AWARD_PLACEMENTS, Award, AwardKind, AwardPlacement } from "../../types/sports";

export interface AwardView {
    id: number;
    kind: AwardKind;
    title: string;
    placement: AwardPlacement | null;
    competition: string | null;
    year: number;
    organization: OrganizationSummary;
    team: { id: number, name: string } | null;
    recipients: { email: string, name: string, profile_photo_url: string | null }[];
}

/** Awards granted by an organization, of a team, or received by a user; newest first. */
export async function listAwards(filter: { organizationId?: number, teamId?: number, email?: string }): Promise<AwardView[]> {
    const query = db("awards")
        .select<Award[]>("*")
        .orderBy("year", "desc")
        .orderBy("id", "desc");
    if (filter.organizationId !== undefined) query.where({ organization_id: filter.organizationId });
    if (filter.teamId !== undefined) query.where({ sports_team_id: filter.teamId });
    if (filter.email !== undefined)
        query.whereIn("id", db("award_recipients").select("award_id").where({ user_email: filter.email }));
    const awards = await query;
    if (awards.length === 0) return [];

    const ids = awards.map((award) => award.id);
    const recipients = await db("award_recipients as r")
        .join("users as u", "u.email", "r.user_email")
        .whereIn("r.award_id", ids)
        .orderBy("u.nickname", "asc")
        .select<{ award_id: number, email: string, name: string, profile_photo_url: string | null }[]>(
            "r.award_id", "r.user_email as email", "u.nickname as name", "u.profile_photo_url",
        );
    const teamIds = awards.map((award) => award.sports_team_id).filter((id): id is number => id !== null);
    const teams = teamIds.length > 0
        ? await db("sports_teams").whereIn("id", teamIds).select("id", "name")
        : [];
    const teamsById = new Map(teams.map((team) => [team.id, team]));
    const organizations = await organizationSummaries(awards.map((award) => award.organization_id));

    return awards.map((award) => ({
        id: award.id,
        kind: award.kind,
        title: award.title,
        placement: award.placement,
        competition: award.competition,
        year: award.year,
        organization: organizations.get(award.organization_id)!,
        team: award.sports_team_id !== null ? teamsById.get(award.sports_team_id) ?? null : null,
        recipients: recipients
            .filter((recipient) => recipient.award_id === award.id)
            .map(({ email, name, profile_photo_url }) => ({ email, name, profile_photo_url })),
    }));
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) throw new ValidationError(`${field} must have at most ${maxLength} characters`);
    return trimmed.length > 0 ? trimmed : null;
}

export interface CreateAwardInput {
    organization_id?: unknown;
    sports_team_id?: unknown;
    kind?: unknown;
    title?: unknown;
    placement?: unknown;
    competition?: unknown;
    year?: unknown;
    recipients?: unknown;
}

/**
 * Creates an award. Team awards ("equipe", shown as a trophy) need a team of the granting
 * organization and are usually given to its whole roster; individual awards (a medal) may
 * mention a team. Either way, `recipients` lists who gets it on their profile.
 */
export async function createAward(email: string, input: CreateAwardInput): Promise<AwardView> {
    const organizationId = Number(input.organization_id);
    if (!Number.isInteger(organizationId) || organizationId <= 0)
        throw new ValidationError("organization_id must be a positive integer");
    await assertCanManageSports(email, organizationId);

    if (!AWARD_KINDS.includes(input.kind as AwardKind)) throw new ValidationError("kind must be individual or equipe");
    const kind = input.kind as AwardKind;

    const title = optionalText(input.title, "title", 80);
    if (title === null) throw new ValidationError("title is required");

    const placement = input.placement === null || input.placement === undefined || input.placement === "" ? null : input.placement;
    if (placement !== null && !AWARD_PLACEMENTS.includes(placement as AwardPlacement))
        throw new ValidationError("placement must be ouro, prata, bronze or null");

    const year = Number(input.year);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new ValidationError("year must be a valid year");

    let teamId: number | null = null;
    if (input.sports_team_id !== null && input.sports_team_id !== undefined && input.sports_team_id !== "") {
        teamId = Number(input.sports_team_id);
        const team = Number.isInteger(teamId) ? await db("sports_teams").where({ id: teamId }).first() : undefined;
        if (!team || team.organization_id !== organizationId)
            throw new ValidationError("sports_team_id must be a team of this organization");
    }
    if (kind === "equipe" && teamId === null) throw new ValidationError("Team awards need a team");

    if (!Array.isArray(input.recipients) || input.recipients.length === 0 || input.recipients.some((item) => typeof item !== "string"))
        throw new ValidationError("recipients must be a non-empty array of emails");
    const recipients = [...new Set((input.recipients as string[]).map((item) => item.trim()))];

    const id = await db.transaction(async (trx) => {
        const users = await trx("users").whereIn("email", recipients).select("email");
        if (users.length !== recipients.length) throw new ValidationError("Some recipients do not exist");

        const [row] = await trx("awards")
            .insert({
                organization_id: organizationId,
                sports_team_id: teamId,
                kind,
                title,
                placement: placement as AwardPlacement | null,
                competition: optionalText(input.competition, "competition", 80),
                year,
            })
            .returning("id");
        const awardId: number = typeof row === "object" ? row.id : row;
        await trx("award_recipients").insert(recipients.map((user_email) => ({ award_id: awardId, user_email })));
        return awardId;
    });

    const [award] = (await listAwards({ organizationId })).filter((row) => row.id === id);
    return award;
}

export async function deleteAward(email: string, id: number): Promise<void> {
    const award = await db("awards").where({ id }).first();
    if (!award) throw new NotFoundError(`Award ${id} not found`);
    await assertCanManageSports(email, award.organization_id);
    await db("awards").where({ id }).delete();
}
