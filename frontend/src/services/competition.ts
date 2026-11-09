import type { BracketMatch, CopaEdition, EventFlags, Modality, ModalityEvent, ModalityType, ScheduledMatch, Team, TimeSlot, Venue } from '../types/competition'
import type { OrganizationHierarchy } from '../types/organizations'
import type { EventsStandings, Standings } from '../types/standings'
import { request } from './api'

/** `?edition=` for the Copa listings; without it the API uses the current edition. */
function editionQuery(editionId?: number): string {
    return editionId === undefined ? '' : `?edition=${editionId}`
}

// --- EDITIONS ---

export function getEditions(): Promise<CopaEdition[]> {
    return request('/copa-editions')
}

export function createEdition(input: { name: string, year: number, copyModalitiesFrom: number | null, makeCurrent: boolean }): Promise<CopaEdition> {
    return request('/copa-editions', { method: 'POST', body: JSON.stringify(input) })
}

export function updateEdition(id: number, changes: { name?: string, year?: number, isCurrent?: true }): Promise<CopaEdition> {
    return request(`/copa-editions/${id}`, { method: 'PUT', body: JSON.stringify(changes) })
}

export function deleteEdition(id: number): Promise<null> {
    return request(`/copa-editions/${id}`, { method: 'DELETE' })
}

// --- MODALITIES AND TEAMS ---

export function getModalities(editionId?: number): Promise<Modality[]> {
    return request(`/modalities${editionQuery(editionId)}`)
}

/** `code` is the short code people see ("FM"). */
export function createModality(editionId: number, input: { code: string, name: string, type: ModalityType }): Promise<Modality> {
    return request('/modalities', { method: 'POST', body: JSON.stringify({ ...input, editionId }) })
}

/** Only for a modality without bracket, registrations or events. */
export function deleteModality(code: string): Promise<null> {
    return request(`/modalities/${code}`, { method: 'DELETE' })
}

/** Every Copa team, with its bonus and penalty in the edition. */
export function getTeams(editionId?: number): Promise<Team[]> {
    return request(`/teams${editionQuery(editionId)}`)
}

/** Links a Copa team to its AAA (null unlinks). */
export function setTeamOrganization(teamId: number, organizationId: number | null): Promise<Team> {
    return request(`/teams/${teamId}/organization`, { method: 'PUT', body: JSON.stringify({ organizationId }) })
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

export function getBracket(code: string): Promise<BracketMatch[]> {
    return request(`/modalities/${code}/bracket`)
}

/** `slots` are the first-round slots top to bottom; `null` gives the slot's opponent a bye. */
export function createBracket(code: string, slots: (string | null)[]): Promise<BracketMatch[]> {
    return request(`/modalities/${code}/bracket`, {
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
export function setMatchResult(code: string, matchId: number, result: MatchResultInput): Promise<BracketMatch[]> {
    return request(`/modalities/${code}/matches/${matchId}/result`, {
        method: 'PUT',
        body: JSON.stringify(result),
    })
}

/** Reverts a match to unresolved. Responds with the whole bracket. */
export function clearMatchResult(code: string, matchId: number): Promise<BracketMatch[]> {
    return request(`/modalities/${code}/matches/${matchId}/result`, { method: 'DELETE' })
}

export interface MatchScheduleInput {
    scheduledAt: string | null
    venueId: number | null
    redatorTeamId: number | null
    mesarioTeamId: number | null
}

/** Sets when and where a match happens and its neutral teams (redator, mesário). Responds with the whole bracket. */
export function setMatchSchedule(code: string, matchId: number, schedule: MatchScheduleInput): Promise<BracketMatch[]> {
    return request(`/modalities/${code}/matches/${matchId}/schedule`, {
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
    return request(`/teams/${teamId}/scoring`, {
        method: 'PUT',
        body: JSON.stringify({ ...scoring, editionId }),
    })
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

export function getEventsView(code: string): Promise<EventsView> {
    return request(`/modalities/${code}/events`)
}

/** Replaces the registered teams. A team already placed in an event cannot be removed. */
export function setRegistrations(code: string, teamIds: number[]): Promise<EventsView> {
    return request(`/modalities/${code}/registrations`, { method: 'PUT', body: JSON.stringify({ teamIds }) })
}

export function createEvent(code: string, name: string, flags: EventFlags): Promise<EventsView> {
    return request(`/modalities/${code}/events`, { method: 'POST', body: JSON.stringify({ name, ...flags }) })
}

/** Fields left out keep their value. */
export function updateEvent(code: string, eventId: number, changes: Partial<EventFlags & { name: string; finished: boolean }>): Promise<EventsView> {
    return request(`/modalities/${code}/events/${eventId}`, { method: 'PUT', body: JSON.stringify(changes) })
}

/** Deletes the event and its results. */
export function deleteEvent(code: string, eventId: number): Promise<EventsView> {
    return request(`/modalities/${code}/events/${eventId}`, { method: 'DELETE' })
}

/** `positions[0]` is the first place over every athlete; null leaves the position empty. A team may appear twice (once in a relay). Replaces every result of the event. */
export function setEventResults(code: string, eventId: number, positions: (number | null)[]): Promise<EventsView> {
    return request(`/modalities/${code}/events/${eventId}/results`, { method: 'PUT', body: JSON.stringify({ positions }) })
}
