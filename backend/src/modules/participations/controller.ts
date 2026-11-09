import { Knex } from "knex";
import { db } from "../../services/db";
import { AwardView, listAwards } from "../awards/controller";
import {
    assertCanManageSports,
    ForbiddenError,
    getOrganizationPermissions,
    NotFoundError,
    organizationSummaries,
    OrganizationSummary,
    ValidationError,
} from "../organizations/controller";
import { getSportsTeamPermissions } from "../sports-teams/controller";
import { getStandings } from "../standings/controller";
import type { Range } from "../standings/placement";

export type ParticipationKind = "externo" | "copa";

interface ParticipationRow {
    id: number;
    kind: ParticipationKind;
    organization_id: number;
    sports_team_id: number | null;
    competition: string | null;
    year: number | null;
    placement: number | null;
    modality_code: string | null;
    copa_team_id: number | null;
}

export interface Athlete {
    email: string;
    name: string;
    profile_photo_url: string | null;
}

export interface ParticipationView {
    /** null for a Copa entry nobody has filled in yet (no athletes, no awards). */
    id: number | null;
    kind: ParticipationKind;
    organization: OrganizationSummary;
    team: { id: number; name: string } | null;
    /** Championship name; for the Copa, the edition name ("Copa Eng"). */
    competition: string;
    year: number;
    edition: { id: number; name: string; year: number } | null;
    modality: { code: string; short_code: string; name: string } | null;
    copa_team: { id: number; name: string } | null;
    /** Final position (1 = ouro...) or null: just "participação", or a Copa still in progress. */
    placement: number | null;
    /** Copa only: the position or range of positions in the edition standings, live. */
    position_range: Range | null;
    /** Copa only: the modality has not finished yet. */
    in_progress: boolean;
    athletes: Athlete[];
    awards: AwardView[];
}

// --- LOADING ---

/** Live Copa results: by "modality code|team id" → position range and whether the modality is over. */
async function copaResults(editionIds: number[]): Promise<Map<string, { position: Range; finished: boolean }>> {
    const results = new Map<string, { position: Range; finished: boolean }>();
    for (const editionId of new Set(editionIds)) {
        const standings = await getStandings(editionId);
        const finished = new Map(standings.modalities.map((modality) => [modality.code, modality.finished]));
        for (const team of standings.teams) {
            for (const [code, cell] of Object.entries(team.modalities)) {
                if (cell) results.set(`${code}|${team.id}`, { position: cell.position, finished: finished.get(code) ?? false });
            }
        }
    }
    return results;
}

/** Turns participation rows (and pending Copa entries) into views with names, athletes, awards and Copa results. */
async function toViews(rows: (Omit<ParticipationRow, "id"> & { id: number | null })[]): Promise<ParticipationView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id).filter((id): id is number => id !== null);
    const codes = rows.map((row) => row.modality_code).filter((code): code is string => code !== null);
    const teamIds = rows.map((row) => row.sports_team_id).filter((id): id is number => id !== null);
    const copaTeamIds = rows.map((row) => row.copa_team_id).filter((id): id is number => id !== null);

    const [athletes, sportsTeams, modalities, copaTeams, organizations] = await Promise.all([
        ids.length > 0
            ? db("participation_athletes as a").join("users as u", "u.email", "a.user_email").whereIn("a.participation_id", ids)
                .orderBy("u.nickname").select("a.participation_id", "a.user_email as email", "u.nickname as name", "u.profile_photo_url")
            : [],
        teamIds.length > 0 ? db("sports_teams").whereIn("id", teamIds).select("id", "name") : [],
        codes.length > 0
            ? db("modalities as m").join("copa_editions as e", "e.id", "m.edition_id").whereIn("m.code", codes)
                .select("m.code", "m.short_code", "m.name", "e.id as edition_id", "e.name as edition_name", "e.year as edition_year")
            : [],
        copaTeamIds.length > 0 ? db("teams").whereIn("id", copaTeamIds).select("id", "name") : [],
        organizationSummaries(rows.map((row) => row.organization_id)),
    ]);
    const awards = ids.length > 0 ? (await listAwards({ participationIds: ids })) : [];
    const modalityByCode = new Map(modalities.map((m) => [m.code, m]));
    const results = await copaResults(modalities.map((m) => m.edition_id));

    return rows.map((row) => {
        const modality = row.modality_code ? modalityByCode.get(row.modality_code) : undefined;
        const result = row.kind === "copa" ? results.get(`${row.modality_code}|${row.copa_team_id}`) : undefined;
        return {
            id: row.id,
            kind: row.kind,
            organization: organizations.get(row.organization_id)!,
            team: sportsTeams.find((team) => team.id === row.sports_team_id) ?? null,
            competition: modality ? modality.edition_name : row.competition ?? "",
            year: modality ? modality.edition_year : row.year ?? 0,
            edition: modality ? { id: modality.edition_id, name: modality.edition_name, year: modality.edition_year } : null,
            modality: modality ? { code: modality.code, short_code: modality.short_code, name: modality.name } : null,
            copa_team: copaTeams.find((team) => team.id === row.copa_team_id) ?? null,
            placement: row.kind === "copa" ? (result?.finished ? result.position.min : null) : row.placement,
            position_range: result?.position ?? null,
            in_progress: row.kind === "copa" ? !(result?.finished ?? false) : false,
            athletes: athletes
                .filter((athlete) => athlete.participation_id === row.id)
                .map(({ email, name, profile_photo_url }) => ({ email, name, profile_photo_url })),
            awards: awards.filter((award) => award.participation_id === row.id),
        };
    });
}

/** Most recent first. */
function sortViews(views: ParticipationView[]): ParticipationView[] {
    return views.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition, "pt-BR") || (a.modality?.name ?? "").localeCompare(b.modality?.name ?? "", "pt-BR"));
}

/** Participations of a sports team, or the ones a user played in. */
export async function listParticipations(filter: { teamId?: number; email?: string }): Promise<ParticipationView[]> {
    const query = db("participations").select<ParticipationRow[]>("*");
    if (filter.teamId !== undefined) query.where({ sports_team_id: filter.teamId });
    if (filter.email !== undefined)
        query.whereIn("id", db("participation_athletes").select("participation_id").where({ user_email: filter.email }));
    return sortViews(await toViews(await query));
}

async function participationRow(id: number): Promise<ParticipationRow> {
    const row = await db("participations").where({ id }).first();
    if (!row) throw new NotFoundError(`Participation ${id} not found`);
    return row;
}

export async function getParticipation(id: number): Promise<ParticipationView> {
    const [view] = await toViews([await participationRow(id)]);
    return view;
}

/**
 * Every modality of an edition in which a Copa team of the organization takes part (in the
 * bracket or registered), with the live result and the athletes/awards filled in so far.
 */
export async function listCopaEntries(organizationId: number, editionId: number): Promise<ParticipationView[]> {
    const copaTeams = await db("teams").where({ organization_id: organizationId }).select("id");
    if (copaTeams.length === 0) return [];
    const teamIds = copaTeams.map((team) => team.id);
    const modalities = await db("modalities").where({ edition_id: editionId }).select("code");
    const codes = modalities.map((m) => m.code);
    if (codes.length === 0) return [];

    const [inMatches, registered, existing] = await Promise.all([
        db("matches").whereIn("modality_code", codes)
            .where((q) => q.whereIn("team_a_id", teamIds).orWhereIn("team_b_id", teamIds))
            .select("modality_code", "team_a_id", "team_b_id"),
        db("registrations").whereIn("modality_code", codes).whereIn("team_id", teamIds).select("modality_code", "team_id"),
        db("participations").where({ kind: "copa" }).whereIn("modality_code", codes).whereIn("copa_team_id", teamIds).select<ParticipationRow[]>("*"),
    ]);

    const entries = new Map<string, Omit<ParticipationRow, "id"> & { id: number | null }>();
    const add = (code: string, teamId: number) => entries.set(`${code}|${teamId}`, {
        id: null, kind: "copa", organization_id: organizationId, sports_team_id: null,
        competition: null, year: null, placement: null, modality_code: code, copa_team_id: teamId,
    });
    for (const match of inMatches) {
        for (const teamId of [match.team_a_id, match.team_b_id])
            if (teamId !== null && teamIds.includes(teamId)) add(match.modality_code, teamId);
    }
    for (const registration of registered) add(registration.modality_code, registration.team_id);
    for (const row of existing) entries.set(`${row.modality_code}|${row.copa_team_id}`, row);

    return sortViews(await toViews([...entries.values()]));
}

// --- PERMISSIONS ---

/** Externo: the team's DMs and the organization's sports board; Copa: the AAA's sports board (and the LEU's). */
async function canManage(email: string, row: Pick<ParticipationRow, "kind" | "organization_id" | "sports_team_id">): Promise<boolean> {
    if (row.kind === "externo" && row.sports_team_id !== null)
        return (await getSportsTeamPermissions(email, row.sports_team_id)).canManageRoster;
    return (await getOrganizationPermissions(email, row.organization_id)).canManageSports;
}

async function assertCanManage(email: string, row: Pick<ParticipationRow, "kind" | "organization_id" | "sports_team_id">) {
    if (!(await canManage(email, row)))
        throw new ForbiddenError("Only the team's DMs or the sports board can manage this participation");
}

// --- WRITES ---

function parseCompetition(raw: unknown): string {
    if (typeof raw !== "string" || raw.trim().length === 0) throw new ValidationError("competition is required");
    if (raw.trim().length > 80) throw new ValidationError("competition must have at most 80 characters");
    return raw.trim();
}

function parseYear(raw: unknown): number {
    const year = Number(raw);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new ValidationError("year must be a valid year");
    return year;
}

/** null = participação; 1, 2, 3 = ouro, prata, bronze; 4+ = position. */
function parsePlacement(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    const placement = Number(raw);
    if (!Number.isInteger(placement) || placement < 1 || placement > 200) throw new ValidationError("placement must be a positive integer or null");
    return placement;
}

async function parseAthletes(raw: unknown): Promise<string[]> {
    if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string"))
        throw new ValidationError("athletes must be an array of emails");
    const emails = [...new Set((raw as string[]).map((email) => email.trim()))];
    if (emails.length > 0) {
        const users = await db("users").whereIn("email", emails).select("email");
        if (users.length !== emails.length) throw new ValidationError("Some athletes do not exist");
    }
    return emails;
}

/** Replaces the athletes; someone with an award in this participation cannot be removed before the award. */
async function replaceAthletes(trx: Knex.Transaction, participationId: number, emails: string[]) {
    const awarded = await trx("award_recipients as r")
        .join("awards as a", "a.id", "r.award_id")
        .where("a.participation_id", participationId)
        .whereNotIn("r.user_email", emails.length > 0 ? emails : [""])
        .first("r.user_email");
    if (awarded) throw new ValidationError("An athlete with an award here cannot be removed; delete the award first");

    await trx("participation_athletes").where({ participation_id: participationId }).delete();
    if (emails.length > 0)
        await trx("participation_athletes").insert(emails.map((user_email) => ({ participation_id: participationId, user_email })));
}

function insertedId(row: unknown): number {
    return typeof row === "object" && row !== null ? (row as { id: number }).id : (row as number);
}

export interface ExternalInput {
    sports_team_id?: unknown;
    competition?: unknown;
    year?: unknown;
    placement?: unknown;
    athletes?: unknown;
}

/** A championship outside the LEU Copas (TUSCA...), registered by the team's DMs or sports board. */
export async function createExternalParticipation(email: string, input: ExternalInput): Promise<ParticipationView> {
    const teamId = Number(input.sports_team_id);
    const team = Number.isInteger(teamId) ? await db("sports_teams").where({ id: teamId }).first() : undefined;
    if (!team) throw new ValidationError("sports_team_id must be a team");
    await assertCanManage(email, { kind: "externo", organization_id: team.organization_id, sports_team_id: team.id });

    const competition = parseCompetition(input.competition);
    const year = parseYear(input.year);
    const placement = parsePlacement(input.placement);
    const athletes = await parseAthletes(input.athletes ?? []);

    const id = await db.transaction(async (trx) => {
        const [row] = await trx("participations")
            .insert({ kind: "externo", organization_id: team.organization_id, sports_team_id: team.id, competition, year, placement })
            .returning("id");
        const participationId = insertedId(row);
        await replaceAthletes(trx, participationId, athletes);
        return participationId;
    });
    return getParticipation(id);
}

/** Externo: any of competition, year, placement, athletes. Copa: athletes only (the result comes from the Copa). */
export async function updateParticipation(email: string, id: number, input: ExternalInput): Promise<ParticipationView> {
    const row = await participationRow(id);
    await assertCanManage(email, row);

    const changes: Partial<ParticipationRow> = {};
    if (row.kind === "externo") {
        if (input.competition !== undefined) changes.competition = parseCompetition(input.competition);
        if (input.year !== undefined) changes.year = parseYear(input.year);
        if (input.placement !== undefined) changes.placement = parsePlacement(input.placement);
    } else if (input.competition !== undefined || input.year !== undefined || input.placement !== undefined) {
        throw new ValidationError("The result of a Copa participation comes from the Copa itself");
    }
    const athletes = input.athletes === undefined ? null : await parseAthletes(input.athletes);

    await db.transaction(async (trx) => {
        if (Object.keys(changes).length > 0) {
            await trx("participations").where({ id }).update(changes);
            if (changes.competition !== undefined || changes.year !== undefined)
                await trx("awards").where({ participation_id: id }).update({
                    competition: changes.competition ?? row.competition,
                    year: changes.year ?? row.year ?? undefined,
                });
        }
        if (athletes !== null) await replaceAthletes(trx, id, athletes);
    });
    return getParticipation(id);
}

/**
 * Athletes of an AAA in a Copa modality. The participation row is created on first save; the
 * Copa team must belong to the organization and take part in the modality.
 */
export async function setCopaAthletes(email: string, input: { modality_code?: unknown; copa_team_id?: unknown; athletes?: unknown }): Promise<ParticipationView> {
    const code = String(input.modality_code ?? "").toUpperCase();
    const teamId = Number(input.copa_team_id);
    const team = Number.isInteger(teamId) ? await db("teams").where({ id: teamId }).first() : undefined;
    if (!team || team.organization_id === null) throw new ValidationError("copa_team_id must be a Copa team linked to an organization");
    if (!(await db("modalities").where({ code }).first())) throw new ValidationError("modality_code must be a modality");
    await assertCanManageSports(email, team.organization_id);

    const plays = await db("matches").where({ modality_code: code }).where((q) => q.where({ team_a_id: teamId }).orWhere({ team_b_id: teamId })).first()
        ?? await db("registrations").where({ modality_code: code, team_id: teamId }).first();
    if (!plays) throw new ValidationError("This team does not take part in this modality");

    const athletes = await parseAthletes(input.athletes ?? []);
    const id = await db.transaction(async (trx) => {
        const existing = await trx("participations").where({ kind: "copa", modality_code: code, copa_team_id: teamId }).first();
        let participationId = existing?.id;
        if (participationId === undefined) {
            const [row] = await trx("participations")
                .insert({ kind: "copa", organization_id: team.organization_id!, modality_code: code, copa_team_id: teamId })
                .returning("id");
            participationId = insertedId(row);
        }
        await replaceAthletes(trx, participationId, athletes);
        return participationId;
    });
    return getParticipation(id);
}

/** Deletes the participation with its athletes and awards. */
export async function deleteParticipation(email: string, id: number): Promise<void> {
    const row = await participationRow(id);
    await assertCanManage(email, row);
    await db("participations").where({ id }).delete();
}

/** An individual award given in this championship (MVP, destaque...), to athletes of the participation. */
export async function addParticipationAward(email: string, id: number, input: { title?: unknown; recipients?: unknown }): Promise<ParticipationView> {
    const row = await participationRow(id);
    await assertCanManage(email, row);
    const view = await getParticipation(id);

    if (typeof input.title !== "string" || input.title.trim().length === 0) throw new ValidationError("title is required");
    if (input.title.trim().length > 80) throw new ValidationError("title must have at most 80 characters");
    const recipients = await parseAthletes(input.recipients);
    if (recipients.length === 0) throw new ValidationError("recipients must be a non-empty array of emails");
    const athletes = new Set(view.athletes.map((athlete) => athlete.email));
    if (recipients.some((recipient) => !athletes.has(recipient)))
        throw new ValidationError("Awards go to athletes of this participation");

    await db.transaction(async (trx) => {
        const [award] = await trx("awards")
            .insert({
                organization_id: row.organization_id,
                sports_team_id: row.sports_team_id,
                participation_id: id,
                kind: "individual",
                title: (input.title as string).trim(),
                placement: null,
                competition: view.modality ? `${view.competition} · ${view.modality.name}` : view.competition,
                year: view.year,
            })
            .returning("id");
        const awardId = insertedId(award);
        await trx("award_recipients").insert(recipients.map((user_email) => ({ award_id: awardId, user_email })));
    });
    return getParticipation(id);
}

export async function deleteParticipationAward(email: string, id: number, awardId: number): Promise<ParticipationView> {
    const row = await participationRow(id);
    await assertCanManage(email, row);
    const deleted = await db("awards").where({ id: awardId, participation_id: id }).delete();
    if (deleted === 0) throw new NotFoundError(`Award ${awardId} not found in this participation`);
    return getParticipation(id);
}
