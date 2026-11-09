import type { Knex } from "knex";
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
    closePeriods,
    isUniqueViolation,
    parsePeriod,
    Period,
} from "../organizations/controller";
import { StintRole, STINT_ROLES } from "../../types/sports";
import { today } from "../../utils/dates";

export interface SportsTeamMemberView {
    email: string;
    name: string;
    profile_photo_url: string | null;
    /** Current roles; a DM may also play. */
    is_athlete: boolean;
    is_dm: boolean;
}

export interface SportsTeamView {
    id: number;
    name: string;
    organization: OrganizationSummary;
    /** Current roster: DMs first, then athletes, each by name. */
    members: SportsTeamMemberView[];
}

export interface SportsTeamDetail extends SportsTeamView {
    awards: AwardView[];
}

/** Teams (optionally of one organization, or with a given current member) with their current rosters. */
export async function listSportsTeams(filter: { organizationId?: number, memberEmail?: string } = {}): Promise<SportsTeamView[]> {
    const query = db("sports_teams").select("id", "organization_id", "name").orderBy("name", "asc");
    if (filter.organizationId !== undefined) query.where({ organization_id: filter.organizationId });
    if (filter.memberEmail !== undefined)
        query.whereIn("id", db("sports_team_stints").select("team_id").where({ user_email: filter.memberEmail }).whereNull("ended_on"));
    const teams = await query;
    if (teams.length === 0) return [];

    const stints = await db("sports_team_stints as m")
        .join("users as u", "u.email", "m.user_email")
        .whereIn("m.team_id", teams.map((team) => team.id))
        .whereNull("m.ended_on")
        .select<{ team_id: number, email: string, name: string, profile_photo_url: string | null, role: StintRole }[]>(
            "m.team_id", "m.user_email as email", "u.nickname as name", "u.profile_photo_url", "m.role",
        );

    const byTeam = new Map<number, Map<string, SportsTeamMemberView>>();
    for (const stint of stints) {
        const members = byTeam.get(stint.team_id) ?? new Map<string, SportsTeamMemberView>();
        const member = members.get(stint.email)
            ?? { email: stint.email, name: stint.name, profile_photo_url: stint.profile_photo_url, is_athlete: false, is_dm: false };
        if (stint.role === "dm") member.is_dm = true;
        else member.is_athlete = true;
        members.set(stint.email, member);
        byTeam.set(stint.team_id, members);
    }
    const roster = (teamId: number) => [...(byTeam.get(teamId)?.values() ?? [])]
        .sort((a, b) => Number(b.is_dm) - Number(a.is_dm) || a.name.localeCompare(b.name, "pt-BR"));

    const organizations = await organizationSummaries(teams.map((team) => team.organization_id));
    return teams.map((team) => ({
        id: team.id,
        name: team.name,
        organization: organizations.get(team.organization_id)!,
        members: roster(team.id),
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
    const dm = await db("sports_team_stints").where({ team_id: id, user_email: email, role: "dm" }).whereNull("ended_on").first();
    return { canManageTeam: canManageSports, canManageRoster: canManageSports || Boolean(dm) };
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

/**
 * Deletes the team with its roster history; its awards stay on the athletes' profiles,
 * without the team link.
 */
export async function deleteSportsTeam(email: string, id: number): Promise<void> {
    await assertCanManageTeam(email, id);
    await db.transaction(async (trx) => {
        await trx("awards").where({ sports_team_id: id }).update({ sports_team_id: null });
        await trx("sports_team_stints").where({ team_id: id }).delete();
        await trx("sports_teams").where({ id }).delete();
    });
}

/** DMs (not managers) must leave at least one current DM, so they cannot orphan the team by accident. */
async function assertKeepsADm(trx: Knex.Transaction, teamId: number, permissions: SportsTeamPermissions) {
    if (permissions.canManageTeam) return;
    const dm = await trx("sports_team_stints").where({ team_id: teamId, role: "dm" }).whereNull("ended_on").first();
    if (!dm) throw new ValidationError("The team must keep at least one DM");
}

async function assertCanManageRoster(email: string, id: number): Promise<SportsTeamPermissions> {
    const permissions = await getSportsTeamPermissions(email, id);
    if (!permissions.canManageRoster)
        throw new ForbiddenError("Only the team's DMs, presidents and sports directors can edit the roster");
    return permissions;
}

/**
 * Sets the current roster: `members: [{ email, is_athlete, is_dm }]`. Roles that stop are
 * ended today and new ones start today, so the history keeps every period. DMs may edit the
 * roster (and other DMs) of their own team.
 */
export async function setSportsTeamRoster(email: string, id: number, input: { members?: unknown }): Promise<SportsTeamDetail> {
    const permissions = await assertCanManageRoster(email, id);

    if (!Array.isArray(input.members)) throw new ValidationError("members must be an array");
    const members = input.members.map((item) => {
        if (typeof item !== "object" || item === null) throw new ValidationError("Each member must be an object");
        const { email: memberEmail, is_athlete, is_dm } = item as Record<string, unknown>;
        if (typeof memberEmail !== "string" || memberEmail.trim().length === 0)
            throw new ValidationError("Each member needs an email");
        const roles: StintRole[] = [];
        if (is_athlete !== false) roles.push("atleta");
        if (is_dm === true) roles.push("dm");
        if (roles.length === 0) throw new ValidationError("Each member must be an athlete, a DM or both");
        return { email: memberEmail.trim(), roles };
    });

    const emails = members.map((member) => member.email);
    if (new Set(emails).size !== emails.length) throw new ValidationError("The same user cannot appear twice");
    const wanted = new Set(members.flatMap((member) => member.roles.map((role) => `${member.email}|${role}`)));

    await db.transaction(async (trx) => {
        if (emails.length > 0) {
            const users = await trx("users").whereIn("email", emails).select("email");
            if (users.length !== emails.length) throw new ValidationError("Some users do not exist");
        }

        const open = await trx("sports_team_stints").where({ team_id: id }).whereNull("ended_on").select("id", "user_email", "role");
        const openKeys = new Set(open.map((stint) => `${stint.user_email}|${stint.role}`));

        const toClose = open.filter((stint) => !wanted.has(`${stint.user_email}|${stint.role}`)).map((stint) => stint.id);
        if (toClose.length > 0)
            await closePeriods(trx, trx("sports_team_stints").whereIn("id", toClose));

        for (const key of [...wanted].filter((item) => !openKeys.has(item))) {
            const [user_email, role] = key.split("|") as [string, StintRole];
            // Undoing a removal made today reopens that period instead of starting a new one.
            const endedToday = await trx("sports_team_stints").where({ team_id: id, user_email, role, ended_on: today() }).first();
            if (endedToday)
                await trx("sports_team_stints").where({ id: endedToday.id }).update({ ended_on: null });
            else
                await trx("sports_team_stints").insert({ team_id: id, user_email, role, started_on: today(), ended_on: null });
        }

        await assertKeepsADm(trx, id, permissions);
    });

    return getSportsTeam(id);
}

// --- ROSTER HISTORY ---

export interface StintView extends Period {
    id: number;
    email: string;
    name: string;
    profile_photo_url: string | null;
    role: StintRole;
}

/** Every period (current and past) of athletes and DMs: current first, then the most recent. */
export async function listTeamStints(id: number): Promise<StintView[]> {
    await teamRow(id);
    return db("sports_team_stints as s")
        .join("users as u", "u.email", "s.user_email")
        .where("s.team_id", id)
        .orderByRaw("CASE WHEN s.ended_on IS NULL THEN 0 ELSE 1 END")
        .orderBy("s.ended_on", "desc")
        .orderBy("s.started_on", "desc")
        .select<StintView[]>("s.id", "s.user_email as email", "u.nickname as name", "u.profile_photo_url", "s.role", "s.started_on", "s.ended_on");
}

function parseStintRole(raw: unknown): StintRole {
    if (!STINT_ROLES.includes(raw as StintRole)) throw new ValidationError("role must be atleta or dm");
    return raw as StintRole;
}

async function writeStint(write: (trx: Knex.Transaction) => Promise<unknown>, teamId: number, permissions: SportsTeamPermissions) {
    try {
        await db.transaction(async (trx) => {
            await write(trx);
            await assertKeepsADm(trx, teamId, permissions);
        });
    } catch (error) {
        if (isUniqueViolation(error))
            throw new ConflictError("This person already has a current period in this role");
        throw error;
    }
}

export interface StintInput {
    email?: unknown;
    role?: unknown;
    started_on?: unknown;
    ended_on?: unknown;
}

/** Adds a period by hand, usually a past one from before the app existed. */
export async function createTeamStint(email: string, id: number, input: StintInput): Promise<StintView[]> {
    const permissions = await assertCanManageRoster(email, id);
    if (typeof input.email !== "string" || !(await db("users").where({ email: input.email }).first()))
        throw new ValidationError("User does not exist");
    const role = parseStintRole(input.role);
    const period = parsePeriod(input);
    await writeStint((trx) => trx("sports_team_stints").insert({ team_id: id, user_email: input.email as string, role, ...period }), id, permissions);
    return listTeamStints(id);
}

async function stintRow(teamId: number, stintId: number) {
    const row = await db("sports_team_stints").where({ id: stintId, team_id: teamId }).first();
    if (!row) throw new NotFoundError(`Period ${stintId} not found`);
    return row;
}

/** Fixes the role or the dates of a period. */
export async function updateTeamStint(email: string, id: number, stintId: number, input: StintInput): Promise<StintView[]> {
    const permissions = await assertCanManageRoster(email, id);
    const row = await stintRow(id, stintId);
    const role = parseStintRole(input.role ?? row.role);
    const period = parsePeriod({
        started_on: input.started_on ?? row.started_on,
        ended_on: input.ended_on === undefined ? row.ended_on : input.ended_on,
    });
    await writeStint((trx) => trx("sports_team_stints").where({ id: stintId }).update({ role, ...period }), id, permissions);
    return listTeamStints(id);
}

/** Deletes a period entered by mistake (to end a current one, set its `ended_on`). */
export async function deleteTeamStint(email: string, id: number, stintId: number): Promise<StintView[]> {
    const permissions = await assertCanManageRoster(email, id);
    await stintRow(id, stintId);
    await writeStint((trx) => trx("sports_team_stints").where({ id: stintId }).delete(), id, permissions);
    return listTeamStints(id);
}
