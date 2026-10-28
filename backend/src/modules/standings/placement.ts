import type { Match } from "../../types/competition";

/**
 * Pure placement and scoring rules for single-elimination brackets. No database access here,
 * so the rules can be unit-tested with synthetic brackets (see placement.test.ts).
 */

/** The columns of `matches` the rules need. */
export type BracketInput = Pick<Match, "id" | "round" | "team_a_id" | "team_b_id" | "winner_id" | "walkover">;

/** A closed interval of possible values; min === max once the value is settled. */
export interface Range {
    min: number;
    max: number;
}

export type PlacementStatus = "champion" | "alive" | "eliminated";

export interface Placement {
    team_id: number;
    status: PlacementStatus;
    /** Possible final positions (1 = first place). */
    position: Range;
    /** Winner of the match this team lost, when eliminated. */
    eliminated_by: number | null;
    /** The team lost its elimination match by walkover (W.O.): it keeps the position but scores nothing. */
    walkover_loss: boolean;
}

export interface ScoredPlacement extends Placement {
    /** Possible points; null when the modality does not score (fewer than MIN_SCORING_TEAMS teams). */
    points: Range | null;
}

export interface BracketStandings {
    team_count: number;
    finished: boolean;
    placements: ScoredPlacement[];
}

export class StandingsError extends Error {
    name = "Standings Error";
}

/** Points for the supporters ("torcida") bonus. */
export const BONUS_TORCIDA_POINTS = 2;

/** PONTUACAO.md: modalities with fewer teams than this do not score. */
export const MIN_SCORING_TEAMS = 3;
/** PONTUACAO.md: the tables stop at this many teams. */
export const MAX_SCORING_TEAMS = 9;

/** PONTUACAO.md: points by final position (index 0 = 1st place), for each number of registered teams. */
export const POINTS_TABLE: Record<number, readonly number[]> = {
    3: [5, 3, 1],
    4: [6, 4, 2, 1],
    5: [8, 5, 3, 2, 1],
    6: [10, 7, 5, 4, 2, 1],
    7: [11, 8, 6, 5, 3, 2, 1],
    8: [12, 9, 7, 6, 4, 3, 2, 1],
    9: [13, 10, 8, 7, 5, 4, 3, 2, 1],
};

function teamsOf(matches: BracketInput[]): number[] {
    return [...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((t): t is number => t !== null))];
}

/**
 * Possible final positions of every team in a bracket, finished or not.
 *
 * The rule: whoever loses in a round finishes below everyone who got past it, and the
 * losers of a round are ordered by the final position of the team that eliminated them.
 * So 3rd lost the semifinal to the champion, 4th lost it to the runner-up, 5th lost the
 * quarterfinal to the champion, and so on. Positions are given as ranges that narrow as
 * the bracket progresses and collapse to a single value when it is finished.
 */
export function computePlacements(matches: BracketInput[]): Placement[] {
    if (matches.length === 0)
        return [];

    const totalRounds = Math.max(...matches.map((m) => m.round));
    /** Number of teams that take part in a round (1 past the final). Rounds after the first are always full. */
    const slots = (round: number) => 2 ** (totalRounds - round + 1);
    const inRound = (round: number) => matches.filter((m) => m.round === round);
    const involves = (m: BracketInput, team: number) => m.team_a_id === team || m.team_b_id === team;

    const teams = teamsOf(matches);
    const placed = new Map<number, Placement>();

    function alive(team: number, round: number): Placement {
        // Worst case: lose in this round to the lowest-ranked of its winners.
        const worst = slots(round + 1) + inRound(round).length;
        return { team_id: team, status: "alive", position: { min: 1, max: worst }, eliminated_by: null, walkover_loss: false };
    }

    // 1. Teams without a loss: the champion, or still alive waiting for a match.
    for (const team of teams) {
        const own = matches.filter((m) => involves(m, team));
        if (own.some((m) => m.winner_id !== null && m.winner_id !== team))
            continue; // eliminated: placed below, once its eliminator is placed

        const pending = own.filter((m) => m.winner_id === null).sort((a, b) => a.round - b.round)[0];
        if (pending) {
            placed.set(team, alive(team, pending.round));
            continue;
        }

        const last = own.reduce((best, m) => (m.round > best.round ? m : best));
        if (last.round === totalRounds)
            placed.set(team, { team_id: team, status: "champion", position: { min: 1, max: 1 }, eliminated_by: null, walkover_loss: false });
        else
            placed.set(team, alive(team, last.round + 1)); // won, but not placed in the next match yet
    }

    // 2. Eliminated teams, from the final backwards, so every eliminator is already placed.
    for (let round = totalRounds; round >= 1; round--) {
        const played = inRound(round).filter((m) => m.winner_id !== null);
        const playedTeams = new Set(inRound(round).flatMap((m) => [m.team_a_id, m.team_b_id]));
        // Teams in the next round that skipped this one (byes): they rank above this round's
        // losers, but they are not among this round's winners, so they do not count towards the rank.
        const byes = inRound(round + 1)
            .flatMap((m) => [m.team_a_id, m.team_b_id])
            .filter((t): t is number => t !== null && !playedTeams.has(t))
            .map((t) => placed.get(t)!.position);
        const base = slots(round + 1);
        const winnersCount = inRound(round).length;

        for (const m of played) {
            const winner = m.winner_id!;
            const loser = m.team_a_id === winner ? m.team_b_id : m.team_a_id;
            if (loser === null)
                continue;

            // Rank of the eliminator among this round's winners = its position minus the byes above it.
            const eliminator = placed.get(winner)!.position;
            let min = Infinity;
            let max = -Infinity;
            for (let p = eliminator.min; p <= eliminator.max; p++) {
                min = Math.min(min, p - byes.filter((b) => b.min < p).length);
                max = Math.max(max, p - byes.filter((b) => b.max < p).length);
            }
            const rank = { min: Math.max(1, min), max: Math.min(winnersCount, max) };

            placed.set(loser, {
                team_id: loser,
                status: "eliminated",
                position: { min: base + rank.min, max: base + rank.max },
                eliminated_by: winner,
                walkover_loss: Boolean(m.walkover),
            });
        }
    }

    return teams
        .map((t) => placed.get(t)!)
        .sort((a, b) => a.position.min - b.position.min || a.position.max - b.position.max || a.team_id - b.team_id);
}

/**
 * Points of a position range in a modality with `teamCount` teams, following PONTUACAO.md.
 * A walkover loss scores nothing, but nobody moves up to take the position.
 */
export function pointsFor(teamCount: number, position: Range, walkoverLoss: boolean): Range | null {
    if (teamCount < MIN_SCORING_TEAMS)
        return null;
    const table = POINTS_TABLE[teamCount];
    if (!table)
        throw new StandingsError(`Scoring is only defined for up to ${MAX_SCORING_TEAMS} teams; this bracket has ${teamCount}`);
    if (walkoverLoss)
        return { min: 0, max: 0 };
    return { min: table[position.max - 1] ?? 0, max: table[position.min - 1] ?? 0 };
}

/** Placements with points for one modality's bracket. Throws StandingsError when the bracket has more teams than the tables cover. */
export function scoreBracket(matches: BracketInput[]): BracketStandings {
    const placements = computePlacements(matches);
    const teamCount = placements.length;
    const totalRounds = matches.length === 0 ? 0 : Math.max(...matches.map((m) => m.round));
    const finished = matches.some((m) => m.round === totalRounds && m.winner_id !== null);

    return {
        team_count: teamCount,
        finished,
        placements: placements.map((p) => ({ ...p, points: pointsFor(teamCount, p.position, p.walkover_loss) })),
    };
}
