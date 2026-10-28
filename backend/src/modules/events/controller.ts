import { Knex } from "knex";
import { db } from "../../services/db";
import { Event, EVENT_KINDS, EventKind, isEventsModality, Modality, Team } from "../../types/competition";
import { StandingsError } from "../standings/placement";
import { eventPoints, scoreEvents, type EventInput, type EventsStandings } from "./scoring";

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

/** An event as the page shows it: results plus what each position is worth. */
export interface EventView extends EventWithResults {
    /** Points of each position for this event's kind, index 0 = first place; empty when the modality cannot be scored. */
    points_by_position: number[];
}

/** Everything the events page of a modality needs. Every mutation responds with a fresh one. */
export interface EventsView {
    modality: Modality;
    /** Registered teams, by name. */
    teams: Team[];
    events: EventView[];
    /** null when the modality cannot be scored (more teams than the tables cover); see `error`. */
    standings: EventsStandings | null;
    error: string | null;
}

// --- LOADING ---

async function findEventsModality(trx: Knex, code: string): Promise<Modality> {
    const modality = await trx("modalities").where({ code }).first();
    if (!modality)
        throw new NotFoundError(`Modality ${code} not found`);
    if (!isEventsModality(modality.type))
        throw new ValidationError(`Modality ${code} is not decided by events (type ${modality.type})`);
    return modality;
}

/** Registered team ids of a modality, by team name. */
export async function registeredTeamIds(trx: Knex, code: string): Promise<number[]> {
    const rows = await trx("registrations as r")
        .join("teams as t", "t.id", "r.team_id")
        .where("r.modality_code", code)
        .orderBy("t.name")
        .select("r.team_id");
    return rows.map((r) => r.team_id);
}

/** SQLite stores booleans as 0/1; make the API shape the same on every database. */
function normalizeEvent(event: Event): Event {
    return { ...event, finished: Boolean(event.finished) };
}

/** Events of several modalities with their results, grouped by modality code, in display order. */
export async function loadEvents(trx: Knex, codes: string[]): Promise<Map<string, EventWithResults[]>> {
    const [events, results] = await Promise.all([
        trx("events").whereIn("modality_code", codes).orderBy([{ column: "sort_order" }, { column: "id" }]),
        trx("event_results").orderBy("position"),
    ]);
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

export async function getEventsView(code: string): Promise<EventsView> {
    const modality = await findEventsModality(db, code);
    const [teams, events] = await Promise.all([
        db("registrations as r").join("teams as t", "t.id", "r.team_id").where("r.modality_code", code).orderBy("t.name").select("t.*"),
        loadEvents(db, [code]).then((m) => m.get(code)!),
    ]);
    const normalizedTeams: Team[] = teams.map((t) => ({ ...t, bonus_torcida: Boolean(t.bonus_torcida) }));
    const teamIds = normalizedTeams.map((t) => t.id);
    const scored = scoreOrError(teamIds, events);
    const positions = Array.from({ length: teamIds.length }, (_, i) => i + 1);
    return {
        modality,
        teams: normalizedTeams,
        events: events.map((e) => ({ ...e, points_by_position: scored.standings ? positions.map((p) => eventPoints(teamIds.length, p, e.kind)) : [] })),
        ...scored,
    };
}

// --- REGISTRATIONS ---

/**
 * Replaces the set of registered teams. A team with results in any event cannot be removed:
 * clear its results first, so nothing disappears silently.
 */
export async function setRegistrations(code: string, input: { teamIds?: unknown }): Promise<EventsView> {
    if (!Array.isArray(input.teamIds) || input.teamIds.some((id) => typeof id !== "number" || !Number.isInteger(id)))
        throw new ValidationError("teamIds must be an array of integer team ids");
    const teamIds = [...new Set(input.teamIds as number[])];

    await db.transaction(async (trx) => {
        await findEventsModality(trx, code);

        const teams = await trx("teams").whereIn("id", teamIds).select("id");
        const known = new Set(teams.map((t) => t.id));
        const missing = teamIds.filter((id) => !known.has(id));
        if (missing.length > 0)
            throw new ValidationError(`Team${missing.length > 1 ? "s" : ""} ${missing.join(", ")} not found`);

        const current = await registeredTeamIds(trx, code);
        const removed = current.filter((id) => !teamIds.includes(id));
        if (removed.length > 0) {
            const withResults = await trx("event_results as er")
                .join("events as e", "e.id", "er.event_id")
                .join("teams as t", "t.id", "er.team_id")
                .where("e.modality_code", code)
                .whereIn("er.team_id", removed)
                .distinct("t.name");
            if (withResults.length > 0)
                throw new ConflictError(`${withResults.map((r) => r.name).join(", ")} already placed in an event; clear those results first`);
            await trx("registrations").where({ modality_code: code }).whereIn("team_id", removed).delete();
        }

        const added = teamIds.filter((id) => !current.includes(id));
        if (added.length > 0)
            await trx("registrations").insert(added.map((team_id) => ({ modality_code: code, team_id })));
    });

    return getEventsView(code);
}

// --- EVENTS ---

export interface EventInputBody {
    name?: unknown;
    kind?: unknown;
    finished?: unknown;
}

function parseName(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name)
        throw new ValidationError("name is required");
    return name;
}

function parseKind(value: unknown): EventKind {
    if (!EVENT_KINDS.includes(value as EventKind))
        throw new ValidationError(`kind must be one of: ${EVENT_KINDS.join(", ")}`);
    return value as EventKind;
}

async function assertNameFree(trx: Knex, code: string, name: string, exceptId: number | null) {
    const clash = await trx("events").where({ modality_code: code }).whereRaw("lower(name) = lower(?)", [name]).first();
    if (clash && clash.id !== exceptId)
        throw new ConflictError(`Event "${clash.name}" already exists in modality ${code}`);
}

/** Body: { name, kind }. The event goes to the end of the list. */
export async function createEvent(code: string, input: EventInputBody): Promise<EventsView> {
    const name = parseName(input.name);
    const kind = input.kind === undefined ? "normal" : parseKind(input.kind);

    await db.transaction(async (trx) => {
        await findEventsModality(trx, code);
        await assertNameFree(trx, code, name, null);
        const last = await trx("events").where({ modality_code: code }).orderBy("sort_order", "desc").first();
        const sort_order = (last?.sort_order ?? -1) + 1;
        await trx("events").insert({ modality_code: code, name, kind, finished: false, sort_order });
    });

    return getEventsView(code);
}

async function findEvent(trx: Knex, code: string, eventId: number): Promise<Event> {
    const event = await trx("events").where({ id: eventId, modality_code: code }).first();
    if (!event)
        throw new NotFoundError(`Event ${eventId} not found in modality ${code}`);
    return normalizeEvent(event);
}

/** Body: { name?, kind?, finished? }. Fields left out keep their value. */
export async function updateEvent(code: string, eventId: number, input: EventInputBody): Promise<EventsView> {
    const changes: Partial<Pick<Event, "name" | "kind" | "finished">> = {};
    if (input.name !== undefined)
        changes.name = parseName(input.name);
    if (input.kind !== undefined)
        changes.kind = parseKind(input.kind);
    if (input.finished !== undefined) {
        if (typeof input.finished !== "boolean")
            throw new ValidationError("finished must be a boolean");
        changes.finished = input.finished;
    }
    if (Object.keys(changes).length === 0)
        throw new ValidationError("Provide name, kind and/or finished");

    await db.transaction(async (trx) => {
        await findEventsModality(trx, code);
        const event = await findEvent(trx, code, eventId);
        if (changes.name !== undefined)
            await assertNameFree(trx, code, changes.name, event.id);
        await trx("events").where({ id: event.id }).update(changes);
    });

    return getEventsView(code);
}

/** Deletes the event and its results. */
export async function deleteEvent(code: string, eventId: number): Promise<EventsView> {
    await db.transaction(async (trx) => {
        await findEventsModality(trx, code);
        const event = await findEvent(trx, code, eventId);
        await trx("events").where({ id: event.id }).delete();
    });
    return getEventsView(code);
}

// --- RESULTS ---

/**
 * Body: { positions: [teamId | null, ...] }, index 0 = first place. Replaces every result of the
 * event: null leaves the position empty. Teams must be registered and appear at most once.
 */
export async function setEventResults(code: string, eventId: number, input: { positions?: unknown }): Promise<EventsView> {
    if (!Array.isArray(input.positions))
        throw new ValidationError("positions must be an array of team ids (null for an empty position)");
    const positions = input.positions as unknown[];
    if (positions.some((id) => id !== null && (typeof id !== "number" || !Number.isInteger(id))))
        throw new ValidationError("every position must be an integer team id or null");

    const results = positions.flatMap((id, index) => (id === null ? [] : [{ team_id: id as number, position: index + 1 }]));
    const seen = new Set<number>();
    for (const r of results) {
        if (seen.has(r.team_id))
            throw new ValidationError(`Team ${r.team_id} appears in more than one position`);
        seen.add(r.team_id);
    }

    await db.transaction(async (trx) => {
        await findEventsModality(trx, code);
        const event = await findEvent(trx, code, eventId);

        const registered = await registeredTeamIds(trx, code);
        if (positions.length > registered.length)
            throw new ValidationError(`positions has ${positions.length} entries, but only ${registered.length} teams are registered`);
        const unregistered = results.filter((r) => !registered.includes(r.team_id));
        if (unregistered.length > 0)
            throw new ValidationError(`Team${unregistered.length > 1 ? "s" : ""} ${unregistered.map((r) => r.team_id).join(", ")} not registered in modality ${code}`);

        await trx("event_results").where({ event_id: event.id }).delete();
        if (results.length > 0)
            await trx("event_results").insert(results.map((r) => ({ event_id: event.id, ...r })));
    });

    return getEventsView(code);
}
