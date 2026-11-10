import type { BracketMatch, CatalogModality, ChampionsRow, CopaEdition, Cup, EditionResults, EventFlags, Modality, ModalityEvent, ModalityRef, ModalityType, ScheduledMatch, Team, TimeSlot, Venue } from '../types/competition'
import type { OrganizationHierarchy } from '../types/organizations'
import type { EventsStandings, Standings } from '../types/standings'
import { request } from './api'

/** `?edition=` for the Copa listings; without it the API uses the current edition. */
function editionQuery(editionId?: number): string {
    return editionId === undefined ? '' : `?edition=${editionId}`
}

// --- CUPS AND EDITIONS ---

export function getCups(): Promise<Cup[]> {
    return request('/cups')
}

export function createCup(name: string): Promise<Cup> {
    return request('/cups', { method: 'POST', body: JSON.stringify({ name }) })
}

export function renameCup(id: number, name: string): Promise<Cup> {
    return request(`/cups/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
}

/** Only a cup without editions. */
export function deleteCup(id: number): Promise<null> {
    return request(`/cups/${id}`, { method: 'DELETE' })
}

/** Newest first. */
export function getEditions(): Promise<CopaEdition[]> {
    return request('/copa-editions')
}

/** Starts with the modalities and teams of the cup's last edition. `name` replaces the cup's name in this edition. */
export function createEdition(input: { cupId: number, year: number, name: string | null, makeCurrent: boolean }): Promise<CopaEdition> {
    return request('/copa-editions', { method: 'POST', body: JSON.stringify(input) })
}

export function updateEdition(id: number, changes: { cupId?: number, year?: number, name?: string | null, isCurrent?: true }): Promise<CopaEdition> {
    return request(`/copa-editions/${id}`, { method: 'PUT', body: JSON.stringify(changes) })
}

export function deleteEdition(id: number): Promise<null> {
    return request(`/copa-editions/${id}`, { method: 'DELETE' })
}

// --- RESULTS ---

export function getEditionResults(editionId: number): Promise<EditionResults> {
    return request(`/copa-editions/${editionId}/results`)
}

/** Replaces the overall results (`scope = 'overall'`) or a modality's. Ties share a position. */
export function setEditionResults(editionId: number, scope: string, entries: { organizationId: number, position: number, points?: number | null }[]): Promise<EditionResults> {
    return request(`/copa-editions/${editionId}/results`, { method: 'PUT', body: JSON.stringify({ scope, entries }) })
}

/** Saves the live standings as the final results and marks the edition finished. */
export function closeEdition(editionId: number): Promise<EditionResults> {
    return request(`/copa-editions/${editionId}/close`, { method: 'POST' })
}

export function reopenEdition(editionId: number): Promise<EditionResults> {
    return request(`/copa-editions/${editionId}/reopen`, { method: 'POST' })
}

/** Podiums of every edition with saved results, newest first: overall, or of `modality`. */
export function getChampions(filter: { cupId?: number, modality?: string }): Promise<ChampionsRow[]> {
    const params = new URLSearchParams()
    if (filter.cupId !== undefined) params.set('cup_id', String(filter.cupId))
    if (filter.modality) params.set('modality', filter.modality)
    const query = params.toString()
    return request(`/champions${query ? `?${query}` : ''}`)
}

// --- MODALITIES AND TEAMS ---

export function getModalities(editionId?: number): Promise<Modality[]> {
    return request(`/modalities${editionQuery(editionId)}`)
}

/** Every modality of every edition, each with the editions that have it. */
export function getModalityCatalog(): Promise<CatalogModality[]> {
    return request('/modalities/catalog')
}

/** A new catalog modality ("FM"), added to the editions in `editionIds`. */
export function createModality(input: { code: string, name: string, type: ModalityType, editionIds: number[] }): Promise<CatalogModality> {
    return request('/modalities', { method: 'POST', body: JSON.stringify(input) })
}

/** Removes it from the catalog; only when nothing was played in it in any edition. */
export function deleteModality(code: string): Promise<null> {
    return request(`/modalities/${code}`, { method: 'DELETE' })
}

export function addModalityToEdition(editionId: number, code: string): Promise<null> {
    return request(`/copa-editions/${editionId}/modalities/${code}`, { method: 'PUT' })
}

/** Only when nothing was played in it in that edition. */
export function removeModalityFromEdition(editionId: number, code: string): Promise<null> {
    return request(`/copa-editions/${editionId}/modalities/${code}`, { method: 'DELETE' })
}

/** URL of a modality in an edition, plus `rest` (e.g. "/bracket"). */
function modalityUrl(ref: ModalityRef, rest: string): string {
    return `/modalities/${ref.code}${rest}?edition=${ref.edition_id}`
}

/** The teams of the edition (the organizations playing it), with their names and bonus/penalty there. */
export function getTeams(editionId: number): Promise<Team[]> {
    return request(`/copa-editions/${editionId}/teams`)
}

/** `displayName` defaults to the organization's name in the Copas. */
export function addTeam(editionId: number, organizationId: number, displayName?: string): Promise<Team> {
    return request(`/copa-editions/${editionId}/teams`, { method: 'POST', body: JSON.stringify({ organizationId, displayName }) })
}

/** Only a team that has not played or been ranked in the edition. */
export function removeTeam(editionId: number, organizationId: number): Promise<null> {
    return request(`/copa-editions/${editionId}/teams/${organizationId}`, { method: 'DELETE' })
}

export function renameTeam(editionId: number, organizationId: number, displayName: string): Promise<Team> {
    return request(`/copa-editions/${editionId}/teams/${organizationId}`, { method: 'PUT', body: JSON.stringify({ displayName }) })
}

export function getOrganizations(): Promise<OrganizationHierarchy[]> {
    return request('/organizations')
}

export function getOrganization(id: number): Promise<OrganizationHierarchy> {
    return request(`/organizations/${id}`)
}

export function getVenues(): Promise<Venue[]> {
    return request('/venues')
}

export function getTimeSlots(editionId?: number): Promise<TimeSlot[]> {
    return request(`/time-slots${editionQuery(editionId)}`)
}

export function createTimeSlot(startsAt: string, editionId: number): Promise<TimeSlot> {
    return request('/time-slots', { method: 'POST', body: JSON.stringify({ startsAt, editionId }) })
}

export function deleteTimeSlot(id: number): Promise<void> {
    return request(`/time-slots/${id}`, { method: 'DELETE' })
}

/** Every match of every modality of the edition, scheduled ones first. */
export function getMatches(editionId?: number): Promise<ScheduledMatch[]> {
    return request(`/matches${editionQuery(editionId)}`)
}

export function getBracket(modality: ModalityRef): Promise<BracketMatch[]> {
    return request(modalityUrl(modality, '/bracket'))
}

/** `slots` are the team ids of the first-round slots top to bottom; `null` gives the slot's opponent a bye. */
export function createBracket(modality: ModalityRef, slots: (number | null)[]): Promise<BracketMatch[]> {
    return request(modalityUrl(modality, '/bracket'), {
        method: 'POST',
        body: JSON.stringify({ slots }),
    })
}

export interface MatchResultInput {
    scoreA: string
    scoreB: string
    winner: 'a' | 'b'
    /** True when the winner won by W.O. (the match was not played). */
    walkover: boolean
}

/** Sets or replaces a match result. Responds with the whole bracket. */
export function setMatchResult(modality: ModalityRef, matchId: number, result: MatchResultInput): Promise<BracketMatch[]> {
    return request(modalityUrl(modality, `/matches/${matchId}/result`), {
        method: 'PUT',
        body: JSON.stringify(result),
    })
}

/** Reverts a match to unresolved. Responds with the whole bracket. */
export function clearMatchResult(modality: ModalityRef, matchId: number): Promise<BracketMatch[]> {
    return request(modalityUrl(modality, `/matches/${matchId}/result`), { method: 'DELETE' })
}

export interface MatchScheduleInput {
    scheduledAt: string | null
    venueId: number | null
    redatorTeamId: number | null
    mesarioTeamId: number | null
}

/** Sets when and where a match happens and its neutral teams (redator, mesário). Responds with the whole bracket. */
export function setMatchSchedule(modality: ModalityRef, matchId: number, schedule: MatchScheduleInput): Promise<BracketMatch[]> {
    return request(modalityUrl(modality, `/matches/${matchId}/schedule`), {
        method: 'PUT',
        body: JSON.stringify(schedule),
    })
}

/** The "Máx e Mín" table: every team's points (or point range) in every modality, with totals. */
export function getStandings(editionId?: number): Promise<Standings> {
    return request(`/standings${editionQuery(editionId)}`)
}

export interface TeamScoringInput {
    bonusTorcida?: boolean
    penaltyPoints?: number
}

/** Updates a team's supporters bonus and/or penalty points in an edition. Responds with the updated team. */
export function setTeamScoring(teamId: number, editionId: number, scoring: TeamScoringInput): Promise<Team> {
    return request(`/copa-editions/${editionId}/teams/${teamId}`, { method: 'PUT', body: JSON.stringify(scoring) })
}

export function createVenue(name: string, parentId: number | null): Promise<Venue> {
    return request('/venues', { method: 'POST', body: JSON.stringify({ name, parentId }) })
}

/** Renames a venue and/or moves it under another parent (null = root). Fields left out keep their value. */
export function updateVenue(id: number, changes: { name?: string; parentId?: number | null }): Promise<Venue> {
    return request(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(changes) })
}

/** Deletes the venue and every venue nested under it; matches scheduled there lose their venue. */
export function deleteVenue(id: number): Promise<void> {
    return request(`/venues/${id}`, { method: 'DELETE' })
}

// --- EVENTS MODALITIES (atletismo, natação) ---

/** Everything the events page of a modality shows. Every mutation below responds with a fresh one. */
export interface EventsView {
    modality: Modality
    /** Registered teams, by name. */
    teams: Team[]
    events: ModalityEvent[]
    /** null when the modality cannot be scored; see `error`. */
    standings: EventsStandings | null
    error: string | null
}

export function getEventsView(modality: ModalityRef): Promise<EventsView> {
    return request(modalityUrl(modality, '/events'))
}

/** Replaces the registered teams. A team already placed in an event cannot be removed. */
export function setRegistrations(modality: ModalityRef, teamIds: number[]): Promise<EventsView> {
    return request(modalityUrl(modality, '/registrations'), { method: 'PUT', body: JSON.stringify({ teamIds }) })
}

export function createEvent(modality: ModalityRef, name: string, flags: EventFlags): Promise<EventsView> {
    return request(modalityUrl(modality, '/events'), { method: 'POST', body: JSON.stringify({ name, ...flags }) })
}

/** Fields left out keep their value. */
export function updateEvent(modality: ModalityRef, eventId: number, changes: Partial<EventFlags & { name: string; finished: boolean }>): Promise<EventsView> {
    return request(modalityUrl(modality, `/events/${eventId}`), { method: 'PUT', body: JSON.stringify(changes) })
}

/** Deletes the event and its results. */
export function deleteEvent(modality: ModalityRef, eventId: number): Promise<EventsView> {
    return request(modalityUrl(modality, `/events/${eventId}`), { method: 'DELETE' })
}

/** `positions[0]` is the first place over every athlete; null leaves the position empty. A team may appear twice (once in a relay). Replaces every result of the event. */
export function setEventResults(modality: ModalityRef, eventId: number, positions: (number | null)[]): Promise<EventsView> {
    return request(modalityUrl(modality, `/events/${eventId}/results`), { method: 'PUT', body: JSON.stringify({ positions }) })
}
