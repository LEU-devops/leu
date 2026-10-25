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
    score_a: number | null;
    score_b: number | null;
    winner_id: number | null;
    next_match_id: number | null;
    next_slot: "a" | "b" | null;
    status: MatchStatus;
    scheduled_at: string | null;
}

/** Maximum number of teams in a bracket (oitavas de final). */
export const MAX_BRACKET_TEAMS = 16;

declare module "knex/types/tables" {
    interface Tables {
        modalities: Modality;
        teams: Team;
        matches: Match;
    }
}
