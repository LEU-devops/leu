import { db } from "../../services/db";
import { AwardView, listAwards } from "../awards/controller";
import {
    assertCanManageSports,
    ForbiddenError,
    getOrganizationPermissions,
    NotFoundError,
    ValidationError,
    ConflictError,
    organizationSummaries,
    OrganizationSummary,
} from "../organizations/controller";
import "../../types/sports";

export interface SportsTeamMemberView {
    email: string;
    name: string;
    profile_photo_url: string | null;
    is_dm: boolean;
}

export interface SportsTeamView {
    id: number;
    name: string;
    organization: OrganizationSummary;
    /** DMs first, then athletes, each by name. */
    members: SportsTeamMemberView[];
}

export interface SportsTeamDetail extends SportsTeamView {
    awards: AwardView[];
}

/** Teams (optionally of one organization, or with a given member) with their rosters. */
export async function listSportsTeams(filter: { organizationId?: number, memberEmail?: string } = {}): Promise<SportsTeamView[]> {
    const query = db("sports_teams").select("id", "organization_id", "name").orderBy("name", "asc");
    if (filter.organizationId !== undefined) query.where({ organization_id: filter.organizationId });
    if (filter.memberEmail !== undefined)
        query.whereIn("id", db("sports_team_members").select("team_id").where({ user_email: filter.memberEmail }));
    const teams = await query;
    if (teams.length === 0) return [];

    const members = await db("sports_team_members as m")
        .join("users as u", "u.email", "m.user_email")
        .whereIn("m.team_id", teams.map((team) => team.id))
        .select<{ team_id: number, email: string, name: string, profile_photo_url: string | null, is_dm: number | boolean }[]>(
            "m.team_id", "m.user_email as email", "u.nickname as name", "u.profile_photo_url", "m.is_dm",
        );

    const byTeam = new Map<number, SportsTeamMemberView[]>();
    for (const member of members) {
        const list = byTeam.get(member.team_id) ?? [];
        list.push({ email: member.email, name: member.name, profile_photo_url: member.profile_photo_url, is_dm: Boolean(member.is_dm) });
        byTeam.set(member.team_id, list);
    }
    for (const list of byTeam.values())
        list.sort((a, b) => Number(b.is_dm) - Number(a.is_dm) || a.name.localeCompare(b.name, "pt-BR"));

    const organizations = await organizationSummaries(teams.map((team) => team.organization_id));
    return teams.map((team) => ({
        id: team.id,
        name: team.name,
        organization: organizations.get(team.organization_id)!,
        members: byTeam.get(team.id) ?? [],
    }));
}

async function teamRow(id: number) {
    const team = await db("sports_teams").where({ id }).first();
    if (!team) throw new NotFoundError(`Team ${id} not found`);
    return team;
}

export async function getSportsTeam(id: number): Promise<SportsTeamDetail> {
    const team = await teamRow(id);
    const [view] = (await listSportsTeams({ organizationId: team.organization_id })).filter((row) => row.id === id);
    return { ...view, awards: await listAwards({ teamId: id }) };
}

export interface SportsTeamPermissions {
    /** Rename/delete the team and give awards: presidents and sports directors of its organization (or the LEU). */
    canManageTeam: boolean;
    /** Edit athletes and DMs: the above, plus the team's own DMs. */
    canManageRoster: boolean;
}

export async function getSportsTeamPermissions(email: string, id: number): Promise<SportsTeamPermissions> {
    const team = await teamRow(id);
    const { canManageSports } = await getOrganizationPermissions(email, team.organization_id);
    const membership = await db("sports_team_members").where({ team_id: id, user_email: email }).first();
    return { canManageTeam: canManageSports, canManageRoster: canManageSports || Boolean(membership?.is_dm) };
}

function teamName(raw: unknown): string {
    if (typeof raw !== "string" || raw.trim().length === 0) throw new ValidationError("name is required");
    const name = raw.trim();
    if (name.length > 60) throw new ValidationError("name must have at most 60 characters");
    return name;
}

async function assertNameFree(organizationId: number, name: string, exceptId?: number) {
    const query = db("sports_teams")
        .where({ organization_id: organizationId })
        .whereRaw("LOWER(name) = ?", [name.toLowerCase()]);
    if (exceptId !== undefined) query.whereNot({ id: exceptId });
    if (await query.first()) throw new ConflictError("This organization already has a team with this name");
}

export async function createSportsTeam(email: string, input: { organization_id?: unknown, name?: unknown }): Promise<SportsTeamDetail> {
    const organizationId = Number(input.organization_id);
    if (!Number.isInteger(organizationId) || organizationId <= 0)
        throw new ValidationError("organization_id must be a positive integer");
    await assertCanManageSports(email, organizationId);

    const name = teamName(input.name);
    await assertNameFree(organizationId, name);
    const [row] = await db("sports_teams").insert({ organization_id: organizationId, name }).returning("id");
    const id = typeof row === "object" ? row.id : row;
    return getSportsTeam(id);
}

async function assertCanManageTeam(email: string, id: number) {
    if (!(await getSportsTeamPermissions(email, id)).canManageTeam)
        throw new ForbiddenError("Only presidents and sports directors can manage this team");
}

export async function renameSportsTeam(email: string, id: number, input: { name?: unknown }): Promise<SportsTeamDetail> {
    await assertCanManageTeam(email, id);
    const team = await teamRow(id);
    const name = teamName(input.name);
    await assertNameFree(team.organization_id, name, id);
    await db("sports_teams").where({ id }).update({ name });
    return getSportsTeam(id);
}

/** Deletes the team and its roster; its awards stay on the athletes' profiles, without the team link. */
export async function deleteSportsTeam(email: string, id: number): Promise<void> {
    await assertCanManageTeam(email, id);
    await db.transaction(async (trx) => {
        await trx("awards").where({ sports_team_id: id }).update({ sports_team_id: null });
        await trx("sports_team_members").where({ team_id: id }).delete();
        await trx("sports_teams").where({ id }).delete();
    });
}

/**
 * Replaces the whole roster: `members: [{ email, is_dm }]`. DMs may edit the roster (and other DMs)
 * of their own team. The team must keep at least one DM once it has one, unless an organization
 * manager is editing, so a DM cannot leave a team orphaned by accident.
 */
export async function setSportsTeamRoster(email: string, id: number, input: { members?: unknown }): Promise<SportsTeamDetail> {
    const permissions = await getSportsTeamPermissions(email, id);
    if (!permissions.canManageRoster)
        throw new ForbiddenError("Only the team's DMs, presidents and sports directors can edit the roster");

    if (!Array.isArray(input.members)) throw new ValidationError("members must be an array");
    const members = input.members.map((item) => {
        if (typeof item !== "object" || item === null) throw new ValidationError("Each member must be an object");
        const { email: memberEmail, is_dm } = item as Record<string, unknown>;
        if (typeof memberEmail !== "string" || memberEmail.trim().length === 0)
            throw new ValidationError("Each member needs an email");
        return { user_email: memberEmail.trim(), is_dm: is_dm === true };
    });

    const emails = members.map((member) => member.user_email);
    if (new Set(emails).size !== emails.length) throw new ValidationError("The same user cannot appear twice");
    if (!permissions.canManageTeam && !members.some((member) => member.is_dm))
        throw new ValidationError("The team must keep at least one DM");

    await db.transaction(async (trx) => {
        if (emails.length > 0) {
            const users = await trx("users").whereIn("email", emails).select("email");
            if (users.length !== emails.length) throw new ValidationError("Some users do not exist");
        }
        await trx("sports_team_members").where({ team_id: id }).delete();
        if (members.length > 0)
            await trx("sports_team_members").insert(members.map((member) => ({ team_id: id, ...member })));
    });

    return getSportsTeam(id);
}
