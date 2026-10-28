export type ModalityType = 'chaveamento' | 'fase_unica' | EventsModalityType

/**
 * Modalities decided by a set of internal events ("provas") instead of a bracket: athletics and
 * swimming. Each has its own page, listing the modalities of that type (masculino, feminino, absoluto).
 */
export type EventsModalityType = 'atletismo' | 'natacao'

export const EVENTS_MODALITY_TYPES: EventsModalityType[] = ['atletismo', 'natacao']

export function isEventsModality(type: ModalityType): type is EventsModalityType {
    return (EVENTS_MODALITY_TYPES as ModalityType[]).includes(type)
}

/** How an event scores: normal (PONTUACAO.md table), demonstrativa (no points) or revezamento (double). */
export type EventKind = 'normal' | 'demonstrativa' | 'revezamento'

export const EVENT_KINDS: { value: EventKind; label: string; hint: string }[] = [
    { value: 'normal', label: 'Normal', hint: 'Pontua pela tabela' },
    { value: 'demonstrativa', label: 'Demonstrativa', hint: 'Não pontua' },
    { value: 'revezamento', label: 'Revezamento', hint: 'Pontua em dobro' },
]

/** An internal event of an events modality, with its results so far (ordered by position). */
export interface ModalityEvent {
    id: number
    modality_code: string
    name: string
    kind: EventKind
    /** Closed by the organizers: no more positions will be filled. */
    finished: boolean
    sort_order: number
    results: { team_id: number; position: number }[]
    /** Points of each position for this event's kind, index 0 = first place; empty when the modality cannot be scored. */
    points_by_position: number[]
}

export interface Modality {
    code: string
    name: string
    type: ModalityType
}

export interface Team {
    id: number
    name: string
    /** Supporters ("torcida") bonus earned. Used by the scoring page. */
    bonus_torcida: boolean
    /** Points subtracted from the team's total (0 = none). Used by the scoring page. */
    penalty_points: number
}

/** A venue with its full path, e.g. "FEF > Complexo de Vôlei > Q1". */
export interface Venue {
    id: number
    name: string
    parent_id: number | null
    path: string
}

/** A reference start time of the event, as returned by GET /time-slots. */
export interface TimeSlot {
    id: number
    starts_at: string
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
    /** Decided by W.O.: `winner_id` won without the match being played. */
    walkover: boolean
    scheduled_at: string | null
    venue_id: number | null
    venue_name: string | null
    /** Neutral team writing the match report (súmula). */
    redator_team_id: number | null
    redator_team_name: string | null
    /** Neutral team running the table/scoreboard. */
    mesario_team_id: number | null
    mesario_team_name: string | null
}

/** A match of any modality as returned by GET /matches. */
export interface ScheduledMatch extends BracketMatch {
    modality_name: string
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

/** "sáb. 25/10 · 14:00" in the viewer's time zone, or null when unscheduled. */
export function formatSchedule(iso: string | null): string | null {
    if (!iso) return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date)
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
    return `${day} · ${time}`
}
