import { db } from "../../services/db";
import type { CopaEdition } from "../../types/competition";
import { ConflictError, getEdition, listEditions, NotFoundError, ValidationError } from "../editions/controller";
import { organizationSummaries, type OrganizationSummary } from "../organizations/controller";
import { getStandings } from "../standings/controller";
import { assertTeams } from "../teams/controller";

/**
 * Final results of the editions: the overall classification and each modality's, saved so that
 * old champions can be logged without brackets and closed editions stay as they were. Closing an
 * edition fills them from its live standings; they can be edited by hand at any time.
 */

/** "overall" or a modality code. */
export type ResultScope = "overall" | string;

export interface ResultEntry {
    organization: OrganizationSummary;
    /** The name the organization shows in that edition. */
    name: string;
    position: number;
    /** Overall only: the final total, when known. */
    points: number | null;
}

export interface EditionResults {
    edition: CopaEdition;
    overall: ResultEntry[];
    /** Every modality of the edition, with its results so far (possibly none). */
    modalities: { code: string; name: string; results: ResultEntry[] }[];
}

interface ResultRow {
    edition_id: number;
    organization_id: number;
    position: number;
    points?: number | null;
    modality_code?: string;
}

/** Display names of organizations by "edition|organization", falling back to the organization's name. */
async function entries(rows: ResultRow[]): Promise<Map<ResultRow, ResultEntry>> {
    const summaries = await organizationSummaries(rows.map((row) => row.organization_id));
    const names = rows.length > 0
        ? await db("edition_organizations").whereIn("edition_id", [...new Set(rows.map((row) => row.edition_id))]).select("edition_id", "organization_id", "display_name")
        : [];
    const nameOf = new Map(names.map((row) => [`${row.edition_id}|${row.organization_id}`, row.display_name as string]));
    return new Map(rows.map((row) => {
        const organization = summaries.get(row.organization_id)!;
        return [row, {
            organization,
            name: nameOf.get(`${row.edition_id}|${row.organization_id}`) ?? organization.name,
            position: row.position,
            points: row.points ?? null,
        }];
    }));
}

function byPosition(a: ResultEntry, b: ResultEntry): number {
    return a.position - b.position || a.name.localeCompare(b.name, "pt-BR");
}

export async function getResults(editionId: number): Promise<EditionResults> {
    const edition = await getEdition(editionId);
    const [overallRows, modalityRows, modalities] = await Promise.all([
        db("edition_results").where({ edition_id: editionId }).select("*"),
        db("modality_results").where({ edition_id: editionId }).select("*"),
        db("edition_modalities as em").join("modalities as m", "m.code", "em.modality_code").where("em.edition_id", editionId).orderBy("m.name").select("m.code", "m.name"),
    ]);
    const views = await entries([...overallRows, ...modalityRows]);
    return {
        edition,
        overall: overallRows.map((row) => views.get(row)!).sort(byPosition),
        modalities: modalities.map((modality) => ({
            code: modality.code,
            name: modality.name,
            results: modalityRows.filter((row) => row.modality_code === modality.code).map((row) => views.get(row)!).sort(byPosition),
        })),
    };
}

interface EntryInput {
    organizationId: number;
    position: number;
    points: number | null;
}

function parseEntries(raw: unknown, overall: boolean): EntryInput[] {
    if (!Array.isArray(raw)) throw new ValidationError("entries must be an array of { organizationId, position, points? }");
    const parsed = raw.map((item) => {
        const entry = (item ?? {}) as { organizationId?: unknown; position?: unknown; points?: unknown };
        const organizationId = Number(entry.organizationId);
        const position = Number(entry.position);
        if (!Number.isInteger(organizationId)) throw new ValidationError("organizationId must be an organization id");
        if (!Number.isInteger(position) || position < 1 || position > 200) throw new ValidationError("position must be a positive integer");
        let points: number | null = null;
        if (overall && entry.points !== undefined && entry.points !== null && entry.points !== "") {
            points = Number(entry.points);
            if (!Number.isInteger(points)) throw new ValidationError("points must be an integer");
        }
        return { organizationId, position, points };
    });
    if (new Set(parsed.map((entry) => entry.organizationId)).size !== parsed.length)
        throw new ValidationError("An organization appears twice");
    return parsed;
}

/**
 * Body: `{ scope: "overall" | <modality code>, entries: [{ organizationId, position, points? }] }`.
 * Replaces the results of that scope; ties share a position. Only teams of the edition can be ranked.
 */
export async function setResults(editionId: number, input: { scope?: unknown; entries?: unknown }): Promise<EditionResults> {
    await getEdition(editionId);
    const scope = typeof input.scope === "string" ? (input.scope === "overall" ? "overall" : input.scope.toUpperCase()) : "";
    if (!scope) throw new ValidationError('scope must be "overall" or a modality code');
    const overall = scope === "overall";
    if (!overall && !(await db("edition_modalities").where({ edition_id: editionId, modality_code: scope }).first()))
        throw new NotFoundError(`Modality ${scope} is not part of this edition`);
    const parsed = parseEntries(input.entries, overall);

    await db.transaction(async (trx) => {
        await assertTeams(trx, editionId, parsed.map((entry) => entry.organizationId), "organization");
        if (overall) {
            await trx("edition_results").where({ edition_id: editionId }).delete();
            if (parsed.length > 0)
                await trx("edition_results").insert(parsed.map((entry) => ({ edition_id: editionId, organization_id: entry.organizationId, position: entry.position, points: entry.points })));
        } else {
            await trx("modality_results").where({ edition_id: editionId, modality_code: scope }).delete();
            if (parsed.length > 0)
                await trx("modality_results").insert(parsed.map((entry) => ({ edition_id: editionId, modality_code: scope, organization_id: entry.organizationId, position: entry.position })));
        }
    });
    return getResults(editionId);
}

/** Competition ranking (1, 1, 3...) by descending score. */
function rank<T>(items: T[], score: (item: T) => number): { item: T; position: number }[] {
    const sorted = [...items].sort((a, b) => score(b) - score(a));
    return sorted.map((item) => ({ item, position: sorted.findIndex((other) => score(other) === score(item)) + 1 }));
}

/**
 * Closes the edition: saves its live standings as the final results (overall by the minimum total,
 * and each modality's decided positions), replacing what was saved before, and marks it finished.
 */
export async function closeEdition(editionId: number): Promise<EditionResults> {
    const edition = await getEdition(editionId);
    if (edition.finished) throw new ConflictError("This edition is already closed; reopen it first");
    const standings = await getStandings(editionId);

    const overall = rank(standings.teams, (team) => team.total.min);
    const modalityRows = standings.teams.flatMap((team) =>
        Object.entries(team.modalities)
            .filter(([, cell]) => cell !== null && cell.position.min === cell.position.max)
            .map(([code, cell]) => ({ edition_id: editionId, modality_code: code, organization_id: team.id, position: cell!.position.min })));

    await db.transaction(async (trx) => {
        await trx("edition_results").where({ edition_id: editionId }).delete();
        await trx("modality_results").where({ edition_id: editionId }).delete();
        if (overall.length > 0)
            await trx("edition_results").insert(overall.map(({ item, position }) => ({ edition_id: editionId, organization_id: item.id, position, points: item.total.min })));
        if (modalityRows.length > 0)
            await trx("modality_results").insert(modalityRows);
        await trx("copa_editions").where({ id: editionId }).update({ finished: true });
    });
    return getResults(editionId);
}

/** Reopens a closed edition; its saved results stay until it is closed again (or edited). */
export async function reopenEdition(editionId: number): Promise<EditionResults> {
    await getEdition(editionId);
    await db("copa_editions").where({ id: editionId }).update({ finished: false });
    return getResults(editionId);
}

export interface ChampionsRow {
    edition: CopaEdition;
    /** Positions 1 to 3 (more than three entries when there are ties). */
    podium: ResultEntry[];
}

/**
 * The podiums of every edition with saved results, newest first: overall, or of one modality.
 * `cupId` narrows to one cup.
 */
export async function listChampions(filter: { cupId?: number; modality?: string }): Promise<ChampionsRow[]> {
    const editions = await listEditions({ cupId: filter.cupId });
    if (editions.length === 0) return [];
    const ids = editions.map((edition) => edition.id);
    const rows: ResultRow[] = filter.modality
        ? await db("modality_results").whereIn("edition_id", ids).where({ modality_code: filter.modality.toUpperCase() }).where("position", "<=", 3).select("*")
        : await db("edition_results").whereIn("edition_id", ids).where("position", "<=", 3).select("*");
    const views = await entries(rows);
    return editions
        .map((edition) => ({
            edition,
            podium: rows.filter((row) => row.edition_id === edition.id).map((row) => views.get(row)!).sort(byPosition),
        }))
        .filter((row) => row.podium.length > 0);
}
