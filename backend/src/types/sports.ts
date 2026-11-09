import { Organization } from "./organizations";

/** Row shape of `sports_teams`: a team of one organization (LEU or AAA), ex.: "Vôlei Masculino". */
export interface SportsTeam {
    id: number;
    organization_id: Organization["id"];
    name: string;
}

export const STINT_ROLES = ["atleta", "dm"] as const;
export type StintRole = (typeof STINT_ROLES)[number];

/** Row shape of `sports_team_stints`: a period as athlete or DM of a team; `ended_on = null` means current. */
export interface SportsTeamStint {
    id: number;
    team_id: SportsTeam["id"];
    user_email: string;
    role: StintRole;
    started_on: string;
    ended_on: string | null;
}

export const AWARD_KINDS = ["individual", "equipe"] as const;
export type AwardKind = (typeof AWARD_KINDS)[number];

export const AWARD_PLACEMENTS = ["ouro", "prata", "bronze"] as const;
export type AwardPlacement = (typeof AWARD_PLACEMENTS)[number];

/** Row shape of `awards`. */
export interface Award {
    id: number;
    organization_id: Organization["id"];
    sports_team_id: SportsTeam["id"] | null;
    kind: AwardKind;
    title: string;
    placement: AwardPlacement | null;
    competition: string | null;
    year: number;
    /** Set when the award was given within a championship participation (MVP, destaque...). */
    participation_id: number | null;
    created_at: string;
}

/** Row shape of `award_recipients`. */
export interface AwardRecipient {
    award_id: Award["id"];
    user_email: string;
}

declare module "knex/types/tables" {
    interface Tables {
        sports_teams: SportsTeam;
        sports_team_stints: SportsTeamStint;
        awards: Award;
        award_recipients: AwardRecipient;
    }
}
