/** Types of GET /standings: the "Máx e Mín" table. */

import type { ModalityType } from './competition'

/** A closed interval; min === max once the value is settled. */
export interface Range {
    min: number
    max: number
}

export type PlacementStatus = 'champion' | 'alive' | 'eliminated'

/** A team's situation in one modality. */
export interface StandingsCell {
    position: Range
    /** null when the modality does not score (fewer than 3 teams). */
    points: Range | null
    status: PlacementStatus
    eliminated_by: number | null
    /** Lost by W.O.: keeps the position, scores nothing. */
    walkover_loss: boolean
}

/** One column of the table. */
export interface StandingsModality {
    code: string
    name: string
    type: ModalityType
    team_count: number
    finished: boolean
    /** Set when the modality could not be scored; its cells are null. */
    error: string | null
}

/** One row of the table. */
export interface StandingsTeam {
    id: number
    name: string
    /** By modality code. null = nothing to compute (not registered, no bracket yet, ...). */
    modalities: Record<string, StandingsCell | null>
    bonus_torcida: { earned: boolean; points: number }
    penalty_points: number
    /** Modality points, plus the bonus, minus the penalty. */
    total: Range
}

export interface Standings {
    modalities: StandingsModality[]
    teams: StandingsTeam[]
}

/** "6" when settled, "6–7" while it is still a range. */
export function formatRange(range: Range): string {
    return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`
}

/** "3º" when settled, "3º–4º" while it is still a range. */
export function formatPosition(range: Range): string {
    return range.min === range.max ? `${range.min}º` : `${range.min}º–${range.max}º`
}

/** A team's result in one event of an events modality. */
export interface EventCell {
    position: number
    /** Points towards the internal score; 0 for a demonstrativa event. */
    points: number
}

/** A team's situation inside an events modality (atletismo, natação). */
export interface EventsPlacement {
    team_id: number
    /** By event id; null when the team has no position in that event (yet). */
    events: Record<number, EventCell | null>
    /** Possible internal score (sum of the event points). */
    score: Range
    /** Possible final positions in the modality. */
    position: Range
    status: PlacementStatus
    /** Possible points in the overall standings; null when the modality does not score (fewer than 3 teams). */
    points: Range | null
}

export interface EventsStandings {
    team_count: number
    /** Every event is finished (and there is at least one). */
    finished: boolean
    /** Best internal score first. */
    placements: EventsPlacement[]
}
