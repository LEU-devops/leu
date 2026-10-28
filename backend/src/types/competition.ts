export const MODALITY_TYPES = ["chaveamento", "fase_unica", "atletismo", "natacao"] as const;
export type ModalityType = (typeof MODALITY_TYPES)[number];

/**
 * Modalities decided by a set of internal events ("provas") rather than by a bracket: athletics
 * and swimming. Each registered team scores in every event, and the sum of those points gives
 * the final classification of the modality, which is what counts for the overall standings.
 */
export const EVENTS_MODALITY_TYPES = ["atletismo", "natacao"] as const satisfies readonly ModalityType[];
export type EventsModalityType = (typeof EVENTS_MODALITY_TYPES)[number];

export function isEventsModality(type: ModalityType): type is EventsModalityType {
    return (EVENTS_MODALITY_TYPES as readonly ModalityType[]).includes(type);
}

/** Row shape of the `modalities` table. */
export interface Modality {
    code: string;
    name: string;
    type: ModalityType;
}

/** Row shape of the `teams` table. */
export interface Team {
    id: number;
    name: string;
    bonus_torcida: boolean;      // supporters ("torcida") bonus earned
    penalty_points: number;  // points subtracted from the team's total (0 = none)
}

/** Row shape of the `venues` table. */
export interface Venue {
    id: number;
    name: string;
    parent_id: number | null;
}

/** Row shape of the `time_slots` table: a reference start time of the event. */
export interface TimeSlot {
    id: number;
    starts_at: string; // ISO 8601
}

export const STAGES = ["r16", "qf", "sf", "final"] as const;
export type Stage = (typeof STAGES)[number];

export type MatchStatus = "scheduled" | "live" | "finished" | "walkover";

/** Row shape of the `matches` table. */
export interface Match {
    id: number;
    modality_code: string;
    stage: Stage;
    round: number;
    position: number;
    team_a_id: number | null;
    team_b_id: number | null;
    score_a: string | null;
    score_b: string | null;
    winner_id: number | null;
    next_match_id: number | null;
    next_slot: "a" | "b" | null;
    status: MatchStatus;
    scheduled_at: string | null;   // ISO 8601
    walkover: boolean;             // decided by WO: winner_id won without the match being played
    venue_id: number | null;
    redator_team_id: number | null; // neutral team writing the match report (súmula)
    mesario_team_id: number | null; // neutral team running the table/scoreboard
}

/** Row shape of the `registrations` table: a team taking part in an events modality (atletismo, natação). */
export interface Registration {
    modality_code: string;
    team_id: number;
}

/**
 * How an event scores for its modality:
 *  - normal: the PONTUACAO.md table by position;
 *  - demonstrativa: positions are recorded but nobody scores;
 *  - revezamento: double points.
 */
export const EVENT_KINDS = ["normal", "demonstrativa", "revezamento"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Row shape of the `events` table: an internal event ("prova") of an events modality, e.g. "100m rasos". */
export interface Event {
    id: number;
    modality_code: string;
    name: string;
    kind: EventKind;
    /** Closed by the organizers: no more positions will be filled, even if some are empty. */
    finished: boolean;
    /** Display order within the modality. */
    sort_order: number;
}

/** Row shape of the `event_results` table: the team that finished an event in a position (1 = first). */
export interface EventResult {
    event_id: number;
    team_id: number;
    position: number;
}

/** Maximum number of teams in a bracket (oitavas de final). */
export const MAX_BRACKET_TEAMS = 16;

declare module "knex/types/tables" {
    interface Tables {
        modalities: Modality;
        teams: Team;
        venues: Venue;
        matches: Match;
        time_slots: TimeSlot;
        registrations: Registration;
        events: Event;
        event_results: EventResult;
    }
}
