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
import { listEditions } from "../editions/controller";
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
    edition_id: number | null;
    modality_code: string | null;
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
    modality: { code: string; name: string } | null;
    /** Copa only: the organization as a team of the edition (`id` = organization id, `name` = its name there). */
    copa_team: { id: number; name: string } | null;
    /** Final position (1 = ouro...) or null: just "participação", or a Copa still in progress. */
    placement: number | null;
    /** Copa only: the saved final position, else the position or range in the live standings. */
    position_range: Range | null;
    /** Copa only: the modality has not finished yet. */
    in_progress: boolean;
    athletes: Athlete[];
    awards: AwardView[];
}

// --- LOADING ---

/** Key of a Copa entry: an organization in a modality of an edition. */
function copaKey(editionId: number | null, code: string | null, organizationId: number): string {
    return `${editionId}|${code}|${organizationId}`;
}

/**
 * Copa results by `copaKey`: the saved final position when the edition has one for the modality,
 * else the live standings (position range and whether the modality is over).
 */
async function copaResults(editionIds: number[]): Promise<Map<string, { position: Range; finished: boolean }>> {
    const results = new Map<string, { position: Range; finished: boolean }>();
    const ids = [...new Set(editionIds)];
    if (ids.length === 0) return results;
    const saved = await db("modality_results").whereIn("edition_id", ids).select("*");
    const withSaved = new Set(saved.map((row) => `${row.edition_id}|${row.modality_code}`));
    for (const row of saved)
        results.set(copaKey(row.edition_id, row.modality_code, row.organization_id), { position: { min: row.position, max: row.position }, finished: true });

    const editionsWithLive = await db("copa_editions").whereIn("id", ids).where({ finished: false }).pluck("id");
    for (const editionId of editionsWithLive) {
        const standings = await getStandings(editionId);
        const finished = new Map(standings.modalities.map((modality) => [modality.code, modality.finished]));
        for (const team of standings.teams) {
            for (const [code, cell] of Object.entries(team.modalities)) {
                if (cell && !withSaved.has(`${editionId}|${code}`))
                    results.set(copaKey(editionId, code, team.id), { position: cell.position, finished: finished.get(code) ?? false });
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
    const editionIds = [...new Set(rows.map((row) => row.edition_id).filter((id): id is number => id !== null))];
    const teamIds = rows.map((row) => row.sports_team_id).filter((id): id is number => id !== null);

    const [athletes, sportsTeams, modalities, editions, copaNames, organizations] = await Promise.all([
        ids.length > 0
            ? db("participation_athletes as a").join("users as u", "u.email", "a.user_email").whereIn("a.participation_id", ids)
                .orderBy("u.nickname").select("a.participation_id", "a.user_email as email", "u.nickname as name", "u.profile_photo_url")
            : [],
        teamIds.length > 0 ? db("sports_teams").whereIn("id", teamIds).select("id", "name") : [],
        codes.length > 0 ? db("modalities").whereIn("code", codes).select("code", "name") : [],
        editionIds.length > 0 ? listEditions().then((all) => all.filter((edition) => editionIds.includes(edition.id))) : [],
        editionIds.length > 0 ? db("edition_organizations").whereIn("edition_id", editionIds).select("edition_id", "organization_id", "display_name") : [],
        organizationSummaries(rows.map((row) => row.organization_id)),
    ]);
    const awards = ids.length > 0 ? (await listAwards({ participationIds: ids })) : [];
    const modalityByCode = new Map(modalities.map((m) => [m.code, m]));
    const editionById = new Map(editions.map((e) => [e.id, e]));
    const copaNameOf = new Map(copaNames.map((row) => [`${row.edition_id}|${row.organization_id}`, row.display_name as string]));
    const results = await copaResults(editionIds);

    return rows.map((row) => {
        const modality = row.modality_code ? modalityByCode.get(row.modality_code) : undefined;
        const edition = row.edition_id !== null ? editionById.get(row.edition_id) : undefined;
        const organization = organizations.get(row.organization_id)!;
        const isCopa = row.kind === "copa";
        const result = isCopa ? results.get(copaKey(row.edition_id, row.modality_code, row.organization_id)) : undefined;
        return {
            id: row.id,
            kind: row.kind,
            organization,
            team: sportsTeams.find((team) => team.id === row.sports_team_id) ?? null,
            competition: edition ? edition.name : row.competition ?? "",
            year: edition ? edition.year : row.year ?? 0,
            edition: edition ? { id: edition.id, name: edition.name, year: edition.year } : null,
            modality: modality ? { code: modality.code, name: modality.name } : null,
            copa_team: isCopa ? { id: organization.id, name: copaNameOf.get(`${row.edition_id}|${row.organization_id}`) ?? organization.name } : null,
            placement: isCopa ? (result?.finished ? result.position.min : null) : row.placement,
            position_range: result?.position ?? null,
            // In a closed edition, a modality without a saved result is just "participação".
            in_progress: isCopa && !edition?.finished ? !(result?.finished ?? false) : false,
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
 * Every modality of an edition in which the organization plays (in a bracket, registered or with a
 * saved result), with the result and the athletes/awards filled in so far.
 */
export async function listCopaEntries(organizationId: number, editionId: number): Promise<ParticipationView[]> {
    const [inMatches, registered, ranked, existing] = await Promise.all([
        db("matches").where({ edition_id: editionId })
            .where((q) => q.where({ team_a_id: organizationId }).orWhere({ team_b_id: organizationId }))
            .distinct("modality_code"),
        db("registrations").where({ edition_id: editionId, team_id: organizationId }).select("modality_code"),
        db("modality_results").where({ edition_id: editionId, organization_id: organizationId }).select("modality_code"),
        db("participations").where({ kind: "copa", edition_id: editionId, organization_id: organizationId }).select<ParticipationRow[]>("*"),
    ]);

    const entries = new Map<string, Omit<ParticipationRow, "id"> & { id: number | null }>();
    for (const { modality_code: code } of [...inMatches, ...registered, ...ranked]) {
        entries.set(code, {
            id: null, kind: "copa", organization_id: organizationId, sports_team_id: null,
            competition: null, year: null, placement: null, edition_id: editionId, modality_code: code,
        });
    }
    for (const row of existing) entries.set(row.modality_code!, row);

    return sortViews(await toViews([...entries.values()]));
}

/** Whether the organization plays the modality in the edition (bracket, registration or saved result). */
async function playsModality(editionId: number, code: string, organizationId: number): Promise<boolean> {
    return Boolean(
        await db("matches").where({ edition_id: editionId, modality_code: code }).where((q) => q.where({ team_a_id: organizationId }).orWhere({ team_b_id: organizationId })).first()
        ?? await db("registrations").where({ edition_id: editionId, modality_code: code, team_id: organizationId }).first()
        ?? await db("modality_results").where({ edition_id: editionId, modality_code: code, organization_id: organizationId }).first(),
    );
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
 * Athletes of an organization in a Copa modality of an edition. The participation row is created
 * on first save; the organization must play the modality in that edition.
 */
export async function setCopaAthletes(email: string, editionId: number, input: { modality_code?: unknown; organization_id?: unknown; athletes?: unknown }): Promise<ParticipationView> {
    const code = String(input.modality_code ?? "").toUpperCase();
    const organizationId = Number(input.organization_id);
    if (!Number.isInteger(organizationId)) throw new ValidationError("organization_id must be an organization");
    await assertCanManageSports(email, organizationId);
    if (!(await playsModality(editionId, code, organizationId)))
        throw new ValidationError("This organization does not take part in this modality");

    const athletes = await parseAthletes(input.athletes ?? []);
    const id = await db.transaction(async (trx) => {
        const existing = await trx("participations").where({ kind: "copa", edition_id: editionId, modality_code: code, organization_id: organizationId }).first();
        let participationId = existing?.id;
        if (participationId === undefined) {
            const [row] = await trx("participations")
                .insert({ kind: "copa", organization_id: organizationId, edition_id: editionId, modality_code: code })
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
