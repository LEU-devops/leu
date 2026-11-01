import type { Event, EventFlags, EventResult } from "../../types/competition";
import { MAX_SCORING_TEAMS, MIN_SCORING_TEAMS, POINTS_TABLE, pointsFor, StandingsError, type PlacementStatus, type Range } from "../standings/placement";

/**
 * Pure scoring rules for events modalities (atletismo, natação). No database access here, so the
 * rules can be unit-tested with synthetic data (see scoring.test.ts).
 *
 * A team enters up to two athletes in an event (one in a relay). The positions are recorded over
 * every athlete, but only the best placed athlete of each team counts: the other scores nothing
 * and takes no place, so the places are "compacted" over the teams. Each event then follows the
 * PONTUACAO.md table for the number of teams that took part in it (not the registered teams),
 * doubled in a relay and zeroed in a demonstration. An event scores only once it is finished:
 * until then every registered team may still win it.
 *
 * The sum over the events is the team's internal score, and the internal ranking is the final
 * classification of the modality: the team's position in it is what scores in the overall
 * standings, by the PONTUACAO.md table for the number of registered teams.
 */

/** An event with the results recorded so far. */
export type EventInput = Pick<Event, "id" | "demonstrativa" | "revezamento" | "finished"> & { results: Pick<EventResult, "team_id" | "position">[] };

/** One athlete's result in an event, as the page shows it. */
export interface EventEntry {
    team_id: number;
    /** Over every athlete of the event (1 = first). */
    position: number;
    /** The team's best athlete: the one that takes a place and scores. */
    scores: boolean;
    /** Place among the teams (1 = first), for the scoring athlete only. */
    place: number | null;
    /** Points towards the internal score; null while the event is open, 0 when it does not score. */
    points: number | null;
}

/** A team's result in one finished event. */
export interface EventCell {
    /** Place among the teams (1 = first). */
    position: number;
    /** Points towards the internal score; 0 for a demonstration. */
    points: number;
}

export interface EventsPlacement {
    team_id: number;
    /** By event id; null while the event is open, or when the team did not take part in it. */
    events: Record<number, EventCell | null>;
    /** Possible internal score (sum of the event points). */
    score: Range;
    /** Possible final positions in the modality (1 = first place). */
    position: Range;
    status: PlacementStatus;
    /** Possible points in the overall standings; null when the modality does not score (fewer than MIN_SCORING_TEAMS teams). */
    points: Range | null;
}

export interface EventsStandings {
    team_count: number;
    /** Every event is finished (and there is at least one). */
    finished: boolean;
    placements: EventsPlacement[];
}

/** Athletes a team may enter in one event (one in a relay): only the best placed one scores. */
export const MAX_ATHLETES_PER_TEAM = 2;

/** How many athletes a team may enter in the event. */
export function athletesPerTeam(event: EventFlags): number {
    return event.revezamento ? 1 : MAX_ATHLETES_PER_TEAM;
}

/** Multiplier of the PONTUACAO.md points: a demonstration never scores, a relay scores double. */
export function multiplier(event: EventFlags): number {
    return event.demonstrativa ? 0 : event.revezamento ? 2 : 1;
}

function tableFor(teamCount: number): readonly number[] {
    const table = POINTS_TABLE[Math.max(teamCount, MIN_SCORING_TEAMS)];
    if (!table)
        throw new StandingsError(`Scoring is only defined for up to ${MAX_SCORING_TEAMS} teams; this event has ${teamCount}`);
    return table;
}

/**
 * PONTUACAO.md points of a place in an event that `teamCount` teams took part in. With fewer than
 * MIN_SCORING_TEAMS teams the smallest table is used, so the internal ranking still exists.
 */
export function eventPoints(teamCount: number, place: number, event: EventFlags): number {
    return (tableFor(teamCount)[place - 1] ?? 0) * multiplier(event);
}

/** The most an event can be worth to a team while it is open: first place among every registered team. */
export function maxEventPoints(registeredCount: number, event: EventFlags): number {
    return eventPoints(Math.min(registeredCount, MAX_SCORING_TEAMS), 1, event);
}

/**
 * The results of an event by position, saying which athletes score and with how many points.
 * The first athlete of each team (by position) takes the next place among the teams; the other
 * takes none. Points are only given once the event is finished, by the number of teams in it.
 */
export function eventEntries(event: EventInput): EventEntry[] {
    const sorted = [...event.results].sort((a, b) => a.position - b.position);
    const placed = new Set<number>();
    const entries: EventEntry[] = sorted.map((result) => {
        const scores = !placed.has(result.team_id);
        placed.add(result.team_id);
        return { team_id: result.team_id, position: result.position, scores, place: scores ? placed.size : null, points: null };
    });
    if (event.finished)
        for (const entry of entries)
            entry.points = entry.place === null ? null : eventPoints(placed.size, entry.place, event);
    return entries;
}

/**
 * Classification of the registered teams by their internal score, finished or not.
 *
 * A team's score can only grow, so its minimum is what it already has from the finished events
 * and its maximum adds the first place of every open event, whatever is recorded in it so far.
 * Once every event is finished, tied teams share the position (1, 1, 3, ...). Before that a tie
 * counts against the team in its worst case, since the tie may still be broken; otherwise every
 * team would be "1st" before the first event. The position ranges are bounds: a team's best
 * position assumes it reaches its maximum while every other team stays at its minimum, and vice
 * versa, so they are sound but not always attainable (two teams cannot both win the same event).
 */
export function computeEventsPlacements(teamIds: number[], events: EventInput[]): EventsPlacement[] {
    const teamCount = teamIds.length;
    if (teamCount > MAX_SCORING_TEAMS)
        throw new StandingsError(`Scoring is only defined for up to ${MAX_SCORING_TEAMS} teams; this modality has ${teamCount}`);

    const placements = new Map<number, EventsPlacement>(
        teamIds.map((id) => [id, { team_id: id, events: {}, score: { min: 0, max: 0 }, position: { min: 1, max: 1 }, status: "alive", points: null }]),
    );

    for (const event of events) {
        if (!event.finished) {
            const best = maxEventPoints(teamCount, event);
            for (const placement of placements.values()) {
                placement.events[event.id] = null;
                placement.score.max += best;
            }
            continue;
        }
        for (const entry of eventEntries(event)) {
            const placement = placements.get(entry.team_id);
            if (!placement || !entry.scores)
                continue; // a team no longer registered (the API refuses to leave these behind) or a second athlete
            placement.events[event.id] = { position: entry.place!, points: entry.points! };
            placement.score.min += entry.points!;
            placement.score.max += entry.points!;
        }
        for (const placement of placements.values())
            placement.events[event.id] ??= null;
    }

    const finished = events.length > 0 && events.every((e) => e.finished);
    const all = [...placements.values()];
    for (const placement of all) {
        const others = all.filter((o) => o.team_id !== placement.team_id);
        const min = 1 + others.filter((o) => o.score.min > placement.score.max).length;
        const max = 1 + others.filter((o) => (finished ? o.score.max > placement.score.min : o.score.max >= placement.score.min)).length;
        placement.position = { min, max };
        placement.status = !finished ? "alive" : min === 1 ? "champion" : "eliminated";
        placement.points = pointsFor(teamCount, placement.position, false);
    }

    return all.sort((a, b) => b.score.max - a.score.max || b.score.min - a.score.min || a.team_id - b.team_id);
}

/** Placements with overall points for one events modality. Throws StandingsError when there are more teams than the tables cover. */
export function scoreEvents(teamIds: number[], events: EventInput[]): EventsStandings {
    return {
        team_count: teamIds.length,
        finished: events.length > 0 && events.every((e) => e.finished),
        placements: computeEventsPlacements(teamIds, events),
    };
}
