import type { Award, NewAward, PublicProfile, SportsTeam, SportsTeamDetail, SportsTeamPermissions } from '../types/sports'
import { request } from './api'
import { getToken } from './auth'

export function getSportsTeams(organizationId?: number): Promise<SportsTeam[]> {
    return request(organizationId === undefined ? '/sports-teams' : `/sports-teams?organization_id=${organizationId}`)
}

export function getSportsTeam(id: number): Promise<SportsTeamDetail> {
    return request(`/sports-teams/${id}`)
}

export async function getSportsTeamPermissions(id: number): Promise<SportsTeamPermissions> {
    if (!getToken())
        return { canManageTeam: false, canManageRoster: false }
    return request(`/sports-teams/${id}/permissions`)
}

export function createSportsTeam(organizationId: number, name: string): Promise<SportsTeamDetail> {
    return request('/sports-teams', { method: 'POST', body: JSON.stringify({ organization_id: organizationId, name }) })
}

export function renameSportsTeam(id: number, name: string): Promise<SportsTeamDetail> {
    return request(`/sports-teams/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
}

export function deleteSportsTeam(id: number): Promise<null> {
    return request(`/sports-teams/${id}`, { method: 'DELETE' })
}

export function setSportsTeamRoster(id: number, members: { email: string, is_dm: boolean }[]): Promise<SportsTeamDetail> {
    return request(`/sports-teams/${id}/members`, { method: 'PUT', body: JSON.stringify({ members }) })
}

export function getAwards(filter: { organizationId?: number, teamId?: number, email?: string }): Promise<Award[]> {
    const params = new URLSearchParams()
    if (filter.organizationId !== undefined) params.set('organization_id', String(filter.organizationId))
    if (filter.teamId !== undefined) params.set('team_id', String(filter.teamId))
    if (filter.email !== undefined) params.set('email', filter.email)
    return request(`/awards?${params}`)
}

export function createAward(award: NewAward): Promise<Award> {
    return request('/awards', { method: 'POST', body: JSON.stringify(award) })
}

export function deleteAward(id: number): Promise<null> {
    return request(`/awards/${id}`, { method: 'DELETE' })
}

export function getPublicProfile(email: string): Promise<PublicProfile> {
    return request(`/users/${encodeURIComponent(email)}/profile`)
}

/** Translates the API error messages of this area into Portuguese. */
const ERROR_TRANSLATIONS: [RegExp, string][] = [
    [/already has a team with this name/, 'Esta entidade já tem um time com esse nome.'],
    [/name is required/, 'O nome é obrigatório.'],
    [/name must have at most/, 'O nome pode ter no máximo 60 caracteres.'],
    [/must keep at least one DM/, 'O time precisa continuar com pelo menos um DM.'],
    [/same user cannot appear twice/, 'A mesma pessoa aparece duas vezes.'],
    [/Team awards need a team/, 'Premiações de equipe precisam de um time.'],
    [/title is required/, 'O título é obrigatório.'],
    [/year must be/, 'Ano inválido.'],
    [/recipients must be/, 'Escolha pelo menos uma pessoa premiada.'],
    [/sports_team_id must be/, 'O time precisa ser desta entidade.'],
]

export function sportsErrorMessage(error: unknown, fallback = 'Não foi possível salvar. Tente novamente.'): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403'))
        return 'Você não tem permissão para esta ação.'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    return ERROR_TRANSLATIONS.find(([pattern]) => pattern.test(message))?.[1] ?? fallback
}
