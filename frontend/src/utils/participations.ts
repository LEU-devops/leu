export interface ExternalDetails {
    competition: string
    year: string
    /** Text so the "other position" input can be edited freely; '' = participação. */
    placement: string
}

export function isValidDetails(details: ExternalDetails): boolean {
    const year = Number(details.year)
    const placement = details.placement === '' ? null : Number(details.placement)
    return details.competition.trim().length > 0 && Number.isInteger(year) && year >= 1950 && year <= 2100
        && (placement === null || (Number.isInteger(placement) && placement >= 1))
}

export function detailsPayload(details: ExternalDetails): { competition: string, year: number, placement: number | null } {
    return {
        competition: details.competition.trim(),
        year: Number(details.year),
        placement: details.placement === '' ? null : Number(details.placement),
    }
}
