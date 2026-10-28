import type { BracketMatch, EventKind, Modality, ModalityEvent, ScheduledMatch, Team, TimeSlot, Venue } from '../types/competition'
import type { EventsStandings, Standings } from '../types/standings'
import { request } from './api'

export function getModalities(): Promise<Modality[]> {
    return request('/modalities')
}

export function getTeams(): Promise<Team[]> {
    return request('/teams')
}

export function getVenues(): Promise<Venue[]> {
    return request('/venues')
}

export function getTimeSlots(): Promise<TimeSlot[]> {
    return request('/time-slots')
}

export function createTimeSlot(startsAt: string): Promise<TimeSlot> {
    return request('/time-slots', { method: 'POST', body: JSON.stringify({ startsAt }) })
}

export function deleteTimeSlot(id: number): Promise<void> {
    return request(`/time-slots/${id}`, { method: 'DELETE' })
}

/** Every match of every modality, scheduled ones first. */
export function getMatches(): Promise<ScheduledMatch[]> {
    return request('/matches')
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
export function getStandings(): Promise<Standings> {
    return request('/standings')
}

export interface TeamScoringInput {
    bonusTorcida?: boolean
    penaltyPoints?: number
}

/** Updates a team's supporters bonus and/or penalty points. Responds with the updated team. */
export function setTeamScoring(teamId: number, scoring: TeamScoringInput): Promise<Team> {
    return request(`/teams/${teamId}/scoring`, {
        method: 'PUT',
        body: JSON.stringify(scoring),
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

export function createEvent(code: string, name: string, kind: EventKind): Promise<EventsView> {
    return request(`/modalities/${code}/events`, { method: 'POST', body: JSON.stringify({ name, kind }) })
}

/** Fields left out keep their value. */
export function updateEvent(code: string, eventId: number, changes: { name?: string; kind?: EventKind; finished?: boolean }): Promise<EventsView> {
    return request(`/modalities/${code}/events/${eventId}`, { method: 'PUT', body: JSON.stringify(changes) })
}

/** Deletes the event and its results. */
export function deleteEvent(code: string, eventId: number): Promise<EventsView> {
    return request(`/modalities/${code}/events/${eventId}`, { method: 'DELETE' })
}

/** `positions[0]` is the first place; null leaves the position empty. Replaces every result of the event. */
export function setEventResults(code: string, eventId: number, positions: (number | null)[]): Promise<EventsView> {
    return request(`/modalities/${code}/events/${eventId}/results`, { method: 'PUT', body: JSON.stringify({ positions }) })
}
