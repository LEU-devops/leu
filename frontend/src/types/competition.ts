export type ModalityType = 'chaveamento' | 'fase_unica'

export interface Modality {
    code: string
    name: string
    type: ModalityType
}

export interface Team {
    id: number
    name: string
}

export type Stage = 'r16' | 'qf' | 'sf' | 'final'
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'walkover'

/** A match as returned by GET /modalities/:code/bracket. */
export interface BracketMatch {
    id: number
    modality_code: string
    stage: Stage
    round: number
    position: number
    team_a_id: number | null
    team_a_name: string | null
    team_b_id: number | null
    team_b_name: string | null
    score_a: string | null
    score_b: string | null
    winner_id: number | null
    next_match_id: number | null
    next_slot: 'a' | 'b' | null
    status: MatchStatus
    scheduled_at: string | null
}

export const MAX_BRACKET_TEAMS = 16
export const MIN_BRACKET_TEAMS = 2

/** Label of a round given how many rounds are left after it (0 = final). */
export function stageLabel(roundsFromEnd: number): string {
    return ['Final', 'Semifinal', 'Quartas', 'Oitavas'][roundsFromEnd] ?? `Fase ${roundsFromEnd + 1}`
}

/** Smallest power of two that fits `teamCount` teams. */
export function bracketSize(teamCount: number): number {
    return 2 ** Math.ceil(Math.log2(Math.max(teamCount, 2)))
}

/** Number of matches in each round, from the first round up to the final. */
export function matchesPerRound(size: number): number[] {
    const rounds: number[] = []
    for (let matches = size / 2; matches >= 1; matches /= 2)
        rounds.push(matches)
    return rounds
}

/**
 * Standard seeding order of a bracket: `seedOrder(8)` is [1, 8, 4, 5, 2, 7, 3, 6],
 * meaning slot 0 holds seed 1, slot 1 holds seed 8, and so on.
 */
export function seedOrder(size: number): number[] {
    let order = [1]
    while (order.length < size) {
        const next = order.length * 2
        order = order.flatMap((seed) => [seed, next + 1 - seed])
    }
    return order
}

/**
 * First-round matches that are byes when `byes` slots stay empty. Byes go to the
 * top seeds' matches, which the seeding order spreads evenly across the bracket.
 */
export function byeMatchIndices(size: number, byes: number): Set<number> {
    const order = seedOrder(size)
    const matches = new Set<number>()
    for (let seed = 1; seed <= byes; seed++)
        matches.add(Math.floor(order.indexOf(seed) / 2))
    return matches
}
