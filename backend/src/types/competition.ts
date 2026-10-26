export const MODALITY_TYPES = ["chaveamento", "fase_unica"] as const;
export type ModalityType = (typeof MODALITY_TYPES)[number];

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
    venue_id: number | null;
    neutral_team_id: number | null; // team acting as neutral representative
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
    }
}
