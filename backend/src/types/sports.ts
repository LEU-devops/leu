import { Organization } from "./organizations";

/** Row shape of `sports_teams`: a team of one organization (LEU or AAA), ex.: "Vôlei Masculino". */
export interface SportsTeam {
    id: number;
    organization_id: Organization["id"];
    name: string;
}

/** Row shape of `sports_team_members`: an athlete of a team; DMs are flagged. */
export interface SportsTeamMember {
    team_id: SportsTeam["id"];
    user_email: string;
    is_dm: boolean;
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
        sports_team_members: SportsTeamMember;
        awards: Award;
        award_recipients: AwardRecipient;
    }
}
