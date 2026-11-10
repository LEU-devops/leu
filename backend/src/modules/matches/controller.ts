import { db } from "../../services/db";
import { BRACKET_MATCH_COLUMNS, joinBracketMatch, normalizeMatch, type BracketMatch } from "../modalities/controller";

/** A match of any modality, with the modality name for display outside its bracket. */
export interface ScheduledMatch extends BracketMatch {
    modality_name: string;
}

/** Every match of every modality of an edition, scheduled ones first in chronological order. */
export async function listMatches(editionId: number): Promise<ScheduledMatch[]> {
    const rows: ScheduledMatch[] = await joinBracketMatch(db("matches as m"))
        .join("modalities as mo", "mo.code", "m.modality_code")
        .where("m.edition_id", editionId)
        .select([...BRACKET_MATCH_COLUMNS, "mo.name as modality_name"])
        .orderByRaw("m.scheduled_at IS NULL, m.scheduled_at, m.modality_code, m.round, m.position");
    return rows.map(normalizeMatch);
}
