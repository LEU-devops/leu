import type { BracketMatch, Modality, Team } from '../types/competition'
import { request } from './api'

export function getModalities(): Promise<Modality[]> {
    return request('/modalities')
}

export function getTeams(): Promise<Team[]> {
    return request('/teams')
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
