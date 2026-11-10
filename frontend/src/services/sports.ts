import type { Award, NewAward, Participation, Period, PublicProfile, SportsTeam, SportsTeamDetail, SportsTeamPermissions, StintPeriod, StintRole } from '../types/sports'
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

export function setSportsTeamRoster(id: number, members: { email: string, is_athlete: boolean, is_dm: boolean }[]): Promise<SportsTeamDetail> {
    return request(`/sports-teams/${id}/members`, { method: 'PUT', body: JSON.stringify({ members }) })
}

export function getTeamStints(id: number): Promise<StintPeriod[]> {
    return request(`/sports-teams/${id}/stints`)
}

export function createTeamStint(id: number, stint: Period & { email: string, role: StintRole }): Promise<StintPeriod[]> {
    return request(`/sports-teams/${id}/stints`, { method: 'POST', body: JSON.stringify(stint) })
}

export function updateTeamStint(id: number, stintId: number, period: Period): Promise<StintPeriod[]> {
    return request(`/sports-teams/${id}/stints/${stintId}`, { method: 'PUT', body: JSON.stringify(period) })
}

export function deleteTeamStint(id: number, stintId: number): Promise<StintPeriod[]> {
    return request(`/sports-teams/${id}/stints/${stintId}`, { method: 'DELETE' })
}

// --- PARTICIPATIONS ---

export function getTeamParticipations(teamId: number): Promise<Participation[]> {
    return request(`/participations?team_id=${teamId}`)
}

export function createParticipation(input: { sports_team_id: number, competition: string, year: number, placement: number | null, athletes: string[] }): Promise<Participation> {
    return request('/participations', { method: 'POST', body: JSON.stringify(input) })
}

/** Externo: any field; Copa: athletes only. */
export function updateParticipation(id: number, changes: { competition?: string, year?: number, placement?: number | null, athletes?: string[] }): Promise<Participation> {
    return request(`/participations/${id}`, { method: 'PUT', body: JSON.stringify(changes) })
}

export function deleteParticipation(id: number): Promise<null> {
    return request(`/participations/${id}`, { method: 'DELETE' })
}

/** The Copa modalities of an AAA in an edition, with live results. */
export function getCopaEntries(organizationId: number, editionId: number): Promise<Participation[]> {
    return request(`/participations/copa?organization_id=${organizationId}&edition=${editionId}`)
}

export function setCopaAthletes(editionId: number, modalityCode: string, organizationId: number, athletes: string[]): Promise<Participation> {
    return request('/participations/copa', { method: 'PUT', body: JSON.stringify({ edition_id: editionId, modality_code: modalityCode, organization_id: organizationId, athletes }) })
}

export function addParticipationAward(id: number, title: string, recipients: string[]): Promise<Participation> {
    return request(`/participations/${id}/awards`, { method: 'POST', body: JSON.stringify({ title, recipients }) })
}

export function deleteParticipationAward(id: number, awardId: number): Promise<Participation> {
    return request(`/participations/${id}/awards/${awardId}`, { method: 'DELETE' })
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
    [/must be an athlete, a DM or both/, 'Cada pessoa precisa ser atleta, DM ou os dois.'],
    [/Dates cannot be in the future/, 'As datas não podem estar no futuro.'],
    [/ended_on must be on or after/, 'O fim precisa ser depois do início.'],
    [/started_on must be a date/, 'Informe a data de início.'],
    [/already has a current/, 'Essa pessoa já tem um período atual nesse cargo. Encerre-o antes.'],
    [/Directors need a director_area/, 'Informe a diretoria.'],
    [/User does not exist/, 'Escolha a pessoa.'],
    [/competition is required/, 'Informe o campeonato.'],
    [/Awards go to athletes/, 'A premiação vai para atletas desta participação.'],
    [/with an award here cannot be removed/, 'Quem tem premiação neste campeonato não pode sair da lista. Exclua a premiação antes.'],
    [/does not take part in this modality/, 'Este time não participa desta modalidade.'],
    [/Team results are registered as participations/, 'Resultados de equipe são registrados como participações, na página do time.'],
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
