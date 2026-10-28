/** Types of GET /standings: the "Máx e Mín" table. */

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
    type: 'chaveamento' | 'fase_unica'
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
