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

/** Row shape of `cups`: a competition held every year ("Copa Eng", "Copa Bixo", "InterGestões"). */
export interface Cup {
    id: number;
    name: string;
}

/** Row shape of `copa_editions`: one year of a cup. Exactly one edition (of any cup) is current. */
export interface CopaEditionRow {
    id: number;
    cup_id: Cup["id"];
    year: number;
    /** Shown instead of the cup's name when set. */
    name: string | null;
    is_current: boolean;
    /** Closed: its results are saved and the standings no longer change. */
    finished: boolean;
}

/** An edition as the API returns it. */
export interface CopaEdition {
    id: number;
    cup_id: Cup["id"];
    cup_name: string;
    year: number;
    /** What people see: the custom name, else the cup's name. */
    name: string;
    custom_name: string | null;
    is_current: boolean;
    finished: boolean;
}

/** Row shape of the `modalities` table: the catalog shared by every edition ("FM" = Futsal Masculino). */
export interface Modality {
    code: string;
    name: string;
    type: ModalityType;
}

/** Row shape of `edition_modalities`: the modalities an edition has. */
export interface EditionModality {
    edition_id: CopaEdition["id"];
    modality_code: Modality["code"];
}

/** A modality as played in one edition: what brackets, events and standings work with. */
export interface ModalityInEdition extends Modality {
    edition_id: CopaEdition["id"];
}

/** Catalog view: a modality with the editions that have it. */
export interface CatalogModality extends Modality {
    edition_ids: CopaEdition["id"][];
}

/** Identifies a modality in an edition; brackets, events and registrations belong to one. */
export interface ModalityRef {
    editionId: CopaEdition["id"];
    code: Modality["code"];
}

/**
 * Row shape of `edition_organizations`: an organization playing an edition. In the Copa code a
 * "team" is such an organization: matches, registrations and results store its organization id.
 */
export interface EditionOrganization {
    edition_id: CopaEdition["id"];
    organization_id: number;
    /** The name it shows in this edition (e.g. "FEA"). */
    display_name: string;
    bonus_torcida: boolean;      // supporters ("torcida") bonus earned
    penalty_points: number;      // points subtracted from the team's total (0 = none)
}

/** A team of an edition as the API returns it: `id` is the organization id, `name` its name in the edition. */
export interface Team {
    id: number;
    name: string;
    organization_name: string;
    bonus_torcida: boolean;
    penalty_points: number;
}

/** Row shape of `edition_results`: the final overall position of an organization in an edition. */
export interface EditionResult {
    edition_id: CopaEdition["id"];
    organization_id: number;
    /** 1 = champion; ties share a position. */
    position: number;
    points: number | null;
}

/** Row shape of `modality_results`: the final position of an organization in a modality of an edition. */
export interface ModalityResult {
    edition_id: CopaEdition["id"];
    modality_code: Modality["code"];
    organization_id: number;
    position: number;
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
    edition_id: CopaEdition["id"];
    starts_at: string; // ISO 8601
}

export const STAGES = ["r16", "qf", "sf", "final"] as const;
export type Stage = (typeof STAGES)[number];

export type MatchStatus = "scheduled" | "live" | "finished" | "walkover";

/** Row shape of the `matches` table. */
export interface Match {
    id: number;
    edition_id: CopaEdition["id"];
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
    edition_id: CopaEdition["id"];
    modality_code: string;
    team_id: number;
}

/** The flags that say how an event scores; independent, so a relay can also be a demonstration. */
export interface EventFlags {
    /** Positions are recorded but nobody scores. */
    demonstrativa: boolean;
    /** Double points, and a single athlete (the relay team) per team instead of two. */
    revezamento: boolean;
}

/** Row shape of the `events` table: an internal event ("prova") of an events modality, e.g. "100m rasos". */
export interface Event extends EventFlags {
    id: number;
    edition_id: CopaEdition["id"];
    modality_code: string;
    name: string;
    /** Closed by the organizers: the results are final and the event scores. */
    finished: boolean;
    /** Display order within the modality. */
    sort_order: number;
}

/** Row shape of the `event_results` table: the team of the athlete that finished an event in a position (1 = first). */
export interface EventResult {
    event_id: number;
    team_id: number;
    position: number;
}

/** Maximum number of teams in a bracket (oitavas de final). */
export const MAX_BRACKET_TEAMS = 16;

declare module "knex/types/tables" {
    interface Tables {
        cups: Cup;
        copa_editions: CopaEditionRow;
        modalities: Modality;
        edition_modalities: EditionModality;
        edition_organizations: EditionOrganization;
        edition_results: EditionResult;
        modality_results: ModalityResult;
        venues: Venue;
        matches: Match;
        time_slots: TimeSlot;
        registrations: Registration;
        events: Event;
        event_results: EventResult;
    }
}
