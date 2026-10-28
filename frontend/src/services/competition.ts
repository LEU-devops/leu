import type { BracketMatch, Modality, ScheduledMatch, Team, TimeSlot, Venue } from '../types/competition'
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
