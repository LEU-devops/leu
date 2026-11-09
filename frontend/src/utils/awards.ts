import type { AwardPlacement } from '../types/sports'

/** Medal/trophy colors; `none` is for awards without a placement (destaque, MVP...). */
export const PLACEMENT_COLORS: Record<AwardPlacement | 'none', string> = {
    ouro: '#facc15',
    prata: '#cbd5e1',
    bronze: '#d97706',
    none: '#f87171',
}

export const PLACEMENT_LABELS: Record<AwardPlacement, string> = {
    ouro: 'Ouro',
    prata: 'Prata',
    bronze: 'Bronze',
}

/** Medal color of a final position (1–3); anything else gets the neutral color. */
export function placementColor(placement: number | null): string {
    if (placement === 1) return PLACEMENT_COLORS.ouro
    if (placement === 2) return PLACEMENT_COLORS.prata
    if (placement === 3) return PLACEMENT_COLORS.bronze
    return '#a1a1aa'
}

/** "Ouro", "Prata", "Bronze", "4º lugar" or "Participação". */
export function placementLabel(placement: number | null): string {
    if (placement === 1) return 'Ouro'
    if (placement === 2) return 'Prata'
    if (placement === 3) return 'Bronze'
    if (placement !== null) return `${placement}º lugar`
    return 'Participação'
}

/** Result of a participation as shown: final placement, or the live range of a Copa still running. */
export function participationResult(participation: { placement: number | null, in_progress: boolean, position_range: { min: number, max: number } | null, kind: string }): string {
    if (participation.kind === 'copa' && participation.in_progress) {
        const range = participation.position_range
        if (!range) return 'Em andamento'
        return range.min === range.max ? `Em andamento · ${range.min}º` : `Em andamento · ${range.min}º a ${range.max}º`
    }
    if (participation.kind === 'copa' && participation.position_range && participation.position_range.min !== participation.position_range.max)
        return `${participation.position_range.min}º a ${participation.position_range.max}º lugar`
    return placementLabel(participation.placement)
}
