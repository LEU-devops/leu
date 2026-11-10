import { Knex } from "knex";
import { db } from "../../services/db";
import { Event, EventFlags, isEventsModality, ModalityInEdition, ModalityRef, Team } from "../../types/competition";
import { getEditionModality } from "../modalities/controller";
import { assertTeams, listTeams } from "../teams/controller";
import { StandingsError } from "../standings/placement";
import { athletesPerTeam, eventEntries, scoreEvents, type EventEntry, type EventInput, type EventsStandings } from "./scoring";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

/** An event with its results so far, ordered by position. */
export interface EventWithResults extends Event {
    results: { team_id: number; position: number }[];
}

/** An event as the page shows it: each athlete's result, saying whether it scores and with how many points. */
export interface EventView extends Event {
    results: EventEntry[];
}

/** Everything the events page of a modality needs. Every mutation responds with a fresh one. */
export interface EventsView {
    modality: ModalityInEdition;
    /** Registered teams, by name. */
    teams: Team[];
    events: EventView[];
    /** null when the modality cannot be scored (more teams than the tables cover); see `error`. */
    standings: EventsStandings | null;
    error: string | null;
}

// --- LOADING ---

async function findEventsModality(trx: Knex, ref: ModalityRef): Promise<ModalityInEdition> {
    const modality = await getEditionModality(trx, ref);
    if (!isEventsModality(modality.type))
        throw new ValidationError(`Modality ${ref.code} is not decided by events (type ${modality.type})`);
    return modality;
}

/** `where` clause of the rows (registrations, events) of a modality in an edition. */
function inModality({ editionId, code }: ModalityRef, alias?: string) {
    const prefix = alias ? `${alias}.` : "";
    return { [`${prefix}edition_id`]: editionId, [`${prefix}modality_code`]: code };
}

/** Registered team ids of a modality, by team name. */
export async function registeredTeamIds(trx: Knex, ref: ModalityRef): Promise<number[]> {
    const rows = await trx("registrations as r")
        .join("edition_organizations as t", (join) => join.on("t.organization_id", "r.team_id").andOn("t.edition_id", "r.edition_id"))
        .where(inModality(ref, "r"))
        .orderBy("t.display_name")
        .select("r.team_id");
    return rows.map((r) => r.team_id);
}

/** SQLite stores booleans as 0/1; make the API shape the same on every database. */
function normalizeEvent(event: Event): Event {
    return { ...event, demonstrativa: Boolean(event.demonstrativa), revezamento: Boolean(event.revezamento), finished: Boolean(event.finished) };
}

/** Events of several modalities of an edition with their results, grouped by modality code, in display order. */
export async function loadEvents(trx: Knex, editionId: number, codes: string[]): Promise<Map<string, EventWithResults[]>> {
    const events = await trx("events").where({ edition_id: editionId }).whereIn("modality_code", codes).orderBy([{ column: "sort_order" }, { column: "id" }]);
    const results = events.length > 0 ? await trx("event_results").whereIn("event_id", events.map((e) => e.id)).orderBy("position") : [];
    const byEvent = new Map<number, EventWithResults>();
    const byModality = new Map<string, EventWithResults[]>(codes.map((c) => [c, []]));
    for (const row of events) {
        const event: EventWithResults = { ...normalizeEvent(row), results: [] };
        byEvent.set(event.id, event);
        byModality.get(event.modality_code)!.push(event);
    }
    for (const result of results)
        byEvent.get(result.event_id)?.results.push({ team_id: result.team_id, position: result.position });
    return byModality;
}

/** Scores a modality, turning the scoring limits into `error` instead of failing the request. */
export function scoreOrError(teamIds: number[], events: EventInput[]): { standings: EventsStandings | null; error: string | null } {
    try {
        return { standings: scoreEvents(teamIds, events), error: null };
    } catch (error) {
        if (!(error instanceof StandingsError))
            throw error;
        return { standings: null, error: error.message };
    }
}

/** The page's view of an event; the points of its entries need no table, so they never fail. */
function toView(event: EventWithResults): EventView {
    try {
        return { ...event, results: eventEntries(event) };
    } catch (error) {
        if (!(error instanceof StandingsError))
            throw error;
        return { ...event, results: eventEntries({ ...event, finished: false }) }; // too many teams: shown without points
    }
}

export async function getEventsView(ref: ModalityRef): Promise<EventsView> {
    const modality = await findEventsModality(db, ref);
    const [registered, allTeams, events] = await Promise.all([
        registeredTeamIds(db, ref),
        listTeams(ref.editionId),
        loadEvents(db, ref.editionId, [ref.code]).then((m) => m.get(ref.code)!),
    ]);
    const normalizedTeams: Team[] = allTeams.filter((team) => registered.includes(team.id));
    return {
        modality,
        teams: normalizedTeams,
        events: events.map(toView),
        ...scoreOrError(normalizedTeams.map((t) => t.id), events),
    };
}

// --- REGISTRATIONS ---

/**
 * Replaces the set of registered teams. A team with results in any event cannot be removed:
 * clear its results first, so nothing disappears silently.
 */
export async function setRegistrations(ref: ModalityRef, input: { teamIds?: unknown }): Promise<EventsView> {
    if (!Array.isArray(input.teamIds) || input.teamIds.some((id) => typeof id !== "number" || !Number.isInteger(id)))
        throw new ValidationError("teamIds must be an array of integer team ids");
    const teamIds = [...new Set(input.teamIds as number[])];

    await db.transaction(async (trx) => {
        await findEventsModality(trx, ref);

        await assertTeams(trx, ref.editionId, teamIds);

        const current = await registeredTeamIds(trx, ref);
        const removed = current.filter((id) => !teamIds.includes(id));
        if (removed.length > 0) {
            const withResults = await trx("event_results as er")
                .join("events as e", "e.id", "er.event_id")
                .join("edition_organizations as t", (join) => join.on("t.organization_id", "er.team_id").andOn("t.edition_id", "e.edition_id"))
                .where(inModality(ref, "e"))
                .whereIn("er.team_id", removed)
                .distinct("t.display_name as name");
            if (withResults.length > 0)
                throw new ConflictError(`${withResults.map((r) => r.name).join(", ")} already placed in an event; clear those results first`);
            await trx("registrations").where(inModality(ref)).whereIn("team_id", removed).delete();
        }

        const added = teamIds.filter((id) => !current.includes(id));
        if (added.length > 0)
            await trx("registrations").insert(added.map((team_id) => ({ edition_id: ref.editionId, modality_code: ref.code, team_id })));
    });

    return getEventsView(ref);
}

// --- EVENTS ---

export interface EventInputBody {
    name?: unknown;
    demonstrativa?: unknown;
    revezamento?: unknown;
    finished?: unknown;
}

const FLAGS = ["demonstrativa", "revezamento", "finished"] as const;

function parseName(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name)
        throw new ValidationError("name is required");
    return name;
}

/** The boolean fields present in the body, validated. */
function parseFlags(input: EventInputBody): Partial<EventFlags & Pick<Event, "finished">> {
    const flags: Partial<EventFlags & Pick<Event, "finished">> = {};
    for (const flag of FLAGS) {
        const value = input[flag];
        if (value === undefined)
            continue;
        if (typeof value !== "boolean")
            throw new ValidationError(`${flag} must be a boolean`);
        flags[flag] = value;
    }
    return flags;
}

async function assertNameFree(trx: Knex, ref: ModalityRef, name: string, exceptId: number | null) {
    const clash = await trx("events").where(inModality(ref)).whereRaw("lower(name) = lower(?)", [name]).first();
    if (clash && clash.id !== exceptId)
        throw new ConflictError(`Event "${clash.name}" already exists in modality ${ref.code}`);
}

/** Body: { name, demonstrativa?, revezamento? } (both default to false). The event goes to the end of the list. */
export async function createEvent(ref: ModalityRef, input: EventInputBody): Promise<EventsView> {
    const name = parseName(input.name);
    const { demonstrativa = false, revezamento = false } = parseFlags(input);

    await db.transaction(async (trx) => {
        await findEventsModality(trx, ref);
        await assertNameFree(trx, ref, name, null);
        const last = await trx("events").where(inModality(ref)).orderBy("sort_order", "desc").first();
        const sort_order = (last?.sort_order ?? -1) + 1;
        await trx("events").insert({ edition_id: ref.editionId, modality_code: ref.code, name, demonstrativa, revezamento, finished: false, sort_order });
    });

    return getEventsView(ref);
}

async function findEvent(trx: Knex, ref: ModalityRef, eventId: number): Promise<Event> {
    const event = await trx("events").where({ id: eventId, ...inModality(ref) }).first();
    if (!event)
        throw new NotFoundError(`Event ${eventId} not found in modality ${ref.code}`);
    return normalizeEvent(event);
}

/** Teams with more athletes in the event than `limit`, by name. */
async function teamsOverLimit(trx: Knex, eventId: number, limit: number): Promise<string[]> {
    const rows = await trx("event_results as er")
        .join("events as e", "e.id", "er.event_id")
        .join("edition_organizations as t", (join) => join.on("t.organization_id", "er.team_id").andOn("t.edition_id", "e.edition_id"))
        .where("er.event_id", eventId)
        .groupBy("t.organization_id", "t.display_name")
        .havingRaw("count(*) > ?", [limit])
        .orderBy("t.display_name")
        .select("t.display_name as name");
    return rows.map((r) => r.name);
}

/** Body: { name?, demonstrativa?, revezamento?, finished? }. Fields left out keep their value. */
export async function updateEvent(ref: ModalityRef, eventId: number, input: EventInputBody): Promise<EventsView> {
    const changes: Partial<Pick<Event, "name" | "demonstrativa" | "revezamento" | "finished">> = parseFlags(input);
    if (input.name !== undefined)
        changes.name = parseName(input.name);
    if (Object.keys(changes).length === 0)
        throw new ValidationError("Provide name, demonstrativa, revezamento and/or finished");

    await db.transaction(async (trx) => {
        await findEventsModality(trx, ref);
        const event = await findEvent(trx, ref, eventId);
        if (changes.name !== undefined)
            await assertNameFree(trx, ref, changes.name, event.id);
        if (changes.revezamento && !event.revezamento) {
            // A relay takes one athlete per team: refuse while a team has two placed.
            const over = await teamsOverLimit(trx, event.id, 1);
            if (over.length > 0)
                throw new ConflictError(`${over.join(", ")} already placed two athletes in this event; a relay allows one per team`);
        }
        await trx("events").where({ id: event.id }).update(changes);
    });

    return getEventsView(ref);
}

/** Deletes the event and its results. */
export async function deleteEvent(ref: ModalityRef, eventId: number): Promise<EventsView> {
    await db.transaction(async (trx) => {
        await findEventsModality(trx, ref);
        const event = await findEvent(trx, ref, eventId);
        await trx("events").where({ id: event.id }).delete();
    });
    return getEventsView(ref);
}

// --- RESULTS ---

/**
 * Body: { positions: [teamId | null, ...] }, index 0 = first place over every athlete. Replaces
 * every result of the event: null leaves the position empty. Teams must be registered and may
 * appear up to twice (once in a relay): the second athlete scores nothing and takes no place.
 */
export async function setEventResults(ref: ModalityRef, eventId: number, input: { positions?: unknown }): Promise<EventsView> {
    if (!Array.isArray(input.positions))
        throw new ValidationError("positions must be an array of team ids (null for an empty position)");
    const positions = input.positions as unknown[];
    if (positions.some((id) => id !== null && (typeof id !== "number" || !Number.isInteger(id))))
        throw new ValidationError("every position must be an integer team id or null");

    const results = positions.flatMap((id, index) => (id === null ? [] : [{ team_id: id as number, position: index + 1 }]));

    await db.transaction(async (trx) => {
        await findEventsModality(trx, ref);
        const event = await findEvent(trx, ref, eventId);
        const limit = athletesPerTeam(event);

        const athletes = new Map<number, number>();
        for (const r of results)
            athletes.set(r.team_id, (athletes.get(r.team_id) ?? 0) + 1);
        const over = [...athletes].filter(([, count]) => count > limit).map(([id]) => id);
        if (over.length > 0)
            throw new ValidationError(`Team${over.length > 1 ? "s" : ""} ${over.join(", ")} ${over.length > 1 ? "appear" : "appears"} more than ${limit === 1 ? "once (a relay has one athlete per team)" : `${limit} times`}`);

        const registered = await registeredTeamIds(trx, ref);
        if (positions.length > registered.length * limit)
            throw new ValidationError(`positions has ${positions.length} entries, but ${registered.length} registered teams can enter at most ${registered.length * limit}`);
        const unregistered = results.filter((r) => !registered.includes(r.team_id));
        if (unregistered.length > 0)
            throw new ValidationError(`Team${unregistered.length > 1 ? "s" : ""} ${unregistered.map((r) => r.team_id).join(", ")} not registered in modality ${ref.code}`);

        await trx("event_results").where({ event_id: event.id }).delete();
        if (results.length > 0)
            await trx("event_results").insert(results.map((r) => ({ event_id: event.id, ...r })));
    });

    return getEventsView(ref);
}
