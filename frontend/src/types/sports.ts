import type { OrganizationIdentity, OrganizationRole } from './organizations'

export type OrganizationSummary = Pick<OrganizationIdentity, 'id' | 'name' | 'logo_url' | 'gradient' | 'accent_color'>

export interface SportsTeamMember {
    email: string
    name: string
    profile_photo_url: string | null
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
    recipients: { email: string, name: string, profile_photo_url: string | null }[]
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

export interface PublicProfile {
    email: string
    nickname: string
    full_name: string | null
    profile_photo_url: string | null
    organizations: { organization: OrganizationSummary, role: OrganizationRole, director_area: string | null }[]
    teams: { id: number, name: string, organization: OrganizationSummary, is_dm: boolean }[]
    awards: Award[]
}
