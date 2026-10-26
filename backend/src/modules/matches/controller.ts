import { db } from "../../services/db";
import type { BracketMatch } from "../modalities/controller";

/** A match of any modality, with the modality name for display outside its bracket. */
export interface ScheduledMatch extends BracketMatch {
    modality_name: string;
}

/** Every match of every modality, scheduled ones first in chronological order. */
export async function listMatches(): Promise<ScheduledMatch[]> {
    return db("matches as m")
        .leftJoin("teams as ta", "ta.id", "m.team_a_id")
        .leftJoin("teams as tb", "tb.id", "m.team_b_id")
        .leftJoin("teams as tn", "tn.id", "m.neutral_team_id")
        .leftJoin("venues as v", "v.id", "m.venue_id")
        .join("modalities as mo", "mo.code", "m.modality_code")
        .select(
            "m.*",
            "ta.name as team_a_name",
            "tb.name as team_b_name",
            "tn.name as neutral_team_name",
            "v.name as venue_name",
            "mo.name as modality_name",
        )
        .orderByRaw("m.scheduled_at IS NULL, m.scheduled_at, m.modality_code, m.round, m.position");
}
