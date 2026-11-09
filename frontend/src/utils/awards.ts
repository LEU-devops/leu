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
