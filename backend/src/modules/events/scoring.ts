import type { Event, EventKind, EventResult } from "../../types/competition";
import { MAX_SCORING_TEAMS, MIN_SCORING_TEAMS, POINTS_TABLE, pointsFor, StandingsError, type PlacementStatus, type Range } from "../standings/placement";

/**
 * Pure scoring rules for events modalities (atletismo, natação). No database access here, so the
 * rules can be unit-tested with synthetic data (see scoring.test.ts).
 *
 * Every registered team scores in every event by its position, following the PONTUACAO.md table
 * for the number of registered teams. The sum over the events is the team's internal score, and
 * the internal ranking is the final classification of the modality: the team's position in it is
 * what scores in the overall standings, again by the PONTUACAO.md table.
 */

/** An event with the results recorded so far. */
export type EventInput = Pick<Event, "id" | "kind" | "finished"> & { results: Pick<EventResult, "team_id" | "position">[] };

/** A team's result in one event. */
export interface EventCell {
    position: number;
    /** Points towards the internal score; 0 for a demonstrativa event. */
    points: number;
}

export interface EventsPlacement {
    team_id: number;
    /** By event id; null when the team has no position in that event (yet). */
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

/** Multiplier of the PONTUACAO.md points for each kind of event. */
export const KIND_MULTIPLIER: Record<EventKind, number> = {
    normal: 1,
    demonstrativa: 0,
    revezamento: 2,
};

/**
 * PONTUACAO.md points of a position in one event, for a modality with `teamCount` teams.
 * With fewer than MIN_SCORING_TEAMS teams the modality does not score overall, but the events
 * still use the smallest table so the internal ranking exists. Positions past the table score 0.
 */
export function eventPoints(teamCount: number, position: number, kind: EventKind): number {
    const table = POINTS_TABLE[Math.max(teamCount, MIN_SCORING_TEAMS)];
    if (!table)
        throw new StandingsError(`Scoring is only defined for up to ${MAX_SCORING_TEAMS} teams; this modality has ${teamCount}`);
    return (table[position - 1] ?? 0) * KIND_MULTIPLIER[kind];
}

/**
 * Classification of the registered teams by their internal score, finished or not.
 *
 * A team's score can only grow, so its minimum is what it already has and its maximum adds, for
 * every unfinished event it has no position in, the best position still free in that event.
 * Once every event is finished, tied teams share the position (1, 1, 3, ...). Before that a tie
 * counts against the team in its worst case, since the tie may still be broken; otherwise every
 * team would be "1st" before the first event. The position ranges are bounds: a team's best
 * position assumes it reaches its maximum while every other team stays at its minimum, and vice
 * versa, so they are sound but not always attainable (two teams cannot both win the same event).
 */
export function computeEventsPlacements(teamIds: number[], events: EventInput[]): EventsPlacement[] {
    const teamCount = teamIds.length;

    const placements = new Map<number, EventsPlacement>(
        teamIds.map((id) => [id, { team_id: id, events: {}, score: { min: 0, max: 0 }, position: { min: 1, max: 1 }, status: "alive", points: null }]),
    );

    for (const event of events) {
        const taken = new Set<number>();
        for (const result of event.results) {
            const placement = placements.get(result.team_id);
            if (!placement)
                continue; // result of a team no longer registered: ignored, the API refuses to leave these behind
            taken.add(result.position);
            const points = eventPoints(teamCount, result.position, event.kind);
            placement.events[event.id] = { position: result.position, points };
            placement.score.min += points;
            placement.score.max += points;
        }

        // Best points still available in this event, for the teams without a position in it.
        let best = 0;
        if (!event.finished) {
            for (let position = 1; position <= teamCount; position++) {
                if (!taken.has(position)) {
                    best = eventPoints(teamCount, position, event.kind);
                    break;
                }
            }
        }
        for (const placement of placements.values()) {
            if (placement.events[event.id] === undefined)
                placement.events[event.id] = null;
            if (placement.events[event.id] === null)
                placement.score.max += best;
        }
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
