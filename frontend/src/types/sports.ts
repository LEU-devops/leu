import type { OrganizationIdentity, OrganizationRole } from './organizations'

export type OrganizationSummary = Pick<OrganizationIdentity, 'id' | 'name' | 'logo_url' | 'gradient' | 'accent_color'>

export interface SportsTeamMember {
    email: string
    name: string
    profile_photo_url: string | null
    /** Current roles; a DM may also play. */
    is_athlete: boolean
    is_dm: boolean
}

export interface SportsTeam {
    id: number
    name: string
    organization: OrganizationSummary
    /** DMs first, then athletes. */
    members: SportsTeamMember[]
}

export type AwardKind = 'individual' | 'equipe'
export type AwardPlacement = 'ouro' | 'prata' | 'bronze'

export interface Award {
    id: number
    kind: AwardKind
    title: string
    placement: AwardPlacement | null
    competition: string | null
    year: number
    organization: OrganizationSummary
    team: { id: number, name: string } | null
    /** The championship participation it was given in (MVP, destaque...), if any. */
    participation_id: number | null
    recipients: { email: string, name: string, profile_photo_url: string | null }[]
}

export interface Athlete {
    email: string
    name: string
    profile_photo_url: string | null
}

/**
 * A team in a championship. `externo`: any championship, result typed by the DMs. `copa`: an AAA in a
 * modality of a LEU Copa edition, result read live from the Copa standings.
 */
export interface Participation {
    /** null for a Copa entry nobody has filled in yet. */
    id: number | null
    kind: 'externo' | 'copa'
    organization: OrganizationSummary
    team: { id: number, name: string } | null
    /** Championship name; for the Copa, the edition name. */
    competition: string
    year: number
    edition: { id: number, name: string, year: number } | null
    modality: { code: string, name: string } | null
    copa_team: { id: number, name: string } | null
    /** 1 = ouro, 2 = prata, 3 = bronze, 4+ = position; null = participação (or a Copa still running). */
    placement: number | null
    position_range: { min: number, max: number } | null
    in_progress: boolean
    athletes: Athlete[]
    awards: Award[]
}

export interface SportsTeamDetail extends SportsTeam {
    awards: Award[]
}

export interface SportsTeamPermissions {
    canManageTeam: boolean
    canManageRoster: boolean
}

export interface NewAward {
    organization_id: number
    kind: AwardKind
    title: string
    placement: AwardPlacement | null
    competition: string | null
    year: number
    sports_team_id: number | null
    recipients: string[]
}

/** A period in a role; `ended_on = null` means current. Dates are "YYYY-MM-DD". */
export interface Period {
    started_on: string
    ended_on: string | null
}

export type StintRole = 'atleta' | 'dm'

/** A period of someone in an organization (management history). */
export interface PositionPeriod extends Period {
    id: number
    email: string
    name: string
    profile_photo_url: string | null
    role: OrganizationRole
    director_area: string | null
}

/** A period of someone as athlete or DM of a team. */
export interface StintPeriod extends Period {
    id: number
    email: string
    name: string
    profile_photo_url: string | null
    role: StintRole
}

export interface PublicProfile {
    email: string
    nickname: string
    full_name: string | null
    profile_photo_url: string | null
    /** Current and past positions in the LEU and AAAs. */
    positions: (Period & { organization: OrganizationSummary, role: OrganizationRole, director_area: string | null })[]
    /** Current and past periods as athlete or DM. */
    team_stints: (Period & { team: { id: number, name: string }, organization: OrganizationSummary, role: StintRole })[]
    awards: Award[]
    /** Championships played (Copas and others), with results and the awards given there. */
    participations: Participation[]
}
