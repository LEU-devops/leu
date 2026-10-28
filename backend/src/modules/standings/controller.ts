import { db } from "../../services/db";
import type { Modality, ModalityType } from "../../types/competition";
import { BONUS_TORCIDA_POINTS, scoreBracket, StandingsError, type BracketInput, type PlacementStatus, type Range } from "./placement";

/** One cell of the standings table: a team's situation in one modality. */
export interface StandingsCell {
    position: Range;
    /** null when the modality does not score (fewer than 3 teams). */
    points: Range | null;
    status: PlacementStatus;
    eliminated_by: number | null;
    walkover_loss: boolean;
}

/** One column of the standings table. */
export interface StandingsModality {
    code: string;
    name: string;
    type: ModalityType;
    team_count: number;
    finished: boolean;
    /** Set when the modality could not be scored (e.g. more teams than the tables cover); its cells are null. */
    error: string | null;
}

/** One row of the standings table. */
export interface StandingsTeam {
    id: number;
    name: string;
    /** By modality code. null = nothing to compute: not registered, bracket not created or modality not scored by bracket. */
    modalities: Record<string, StandingsCell | null>;
    bonus_torcida: { earned: boolean; points: number };
    penalty_points: number;
    /** Sum of the modality points, plus the bonus, minus the penalty. */
    total: Range;
}

export interface Standings {
    modalities: StandingsModality[];
    teams: StandingsTeam[];
}

/** Cells of one modality by team id, with the column metadata. */
function scoreModality(modality: Modality, matches: BracketInput[]): { column: StandingsModality; cells: Map<number, StandingsCell> } {
    const column: StandingsModality = { code: modality.code, name: modality.name, type: modality.type, team_count: 0, finished: false, error: null };
    const cells = new Map<number, StandingsCell>();

    if (modality.type !== "chaveamento" || matches.length === 0)
        return { column, cells };

    try {
        const standings = scoreBracket(matches);
        column.team_count = standings.team_count;
        column.finished = standings.finished;
        for (const p of standings.placements)
            cells.set(p.team_id, { position: p.position, points: p.points, status: p.status, eliminated_by: p.eliminated_by, walkover_loss: p.walkover_loss });
    } catch (error) {
        if (!(error instanceof StandingsError))
            throw error;
        column.error = error.message;
        cells.clear();
    }

    return { column, cells };
}

/** The whole standings table: every team against every modality, with bonus, penalty and totals. */
export async function getStandings(): Promise<Standings> {
    const [modalities, teams, matches] = await Promise.all([
        db("modalities").select("*").orderBy("name"),
        db("teams").select("*").orderBy("name"),
        db("matches").select("id", "modality_code", "round", "team_a_id", "team_b_id", "winner_id", "walkover"),
    ]);

    const scored = modalities.map((modality) =>
        scoreModality(
            modality,
            matches.filter((m) => m.modality_code === modality.code).map((m) => ({ ...m, walkover: Boolean(m.walkover) })),
        ),
    );

    return {
        modalities: scored.map((s) => s.column),
        teams: teams.map((team) => {
            const cells: Record<string, StandingsCell | null> = {};
            const total: Range = { min: 0, max: 0 };
            for (const { column, cells: byTeam } of scored) {
                const cell = byTeam.get(team.id) ?? null;
                cells[column.code] = cell;
                if (cell?.points) {
                    total.min += cell.points.min;
                    total.max += cell.points.max;
                }
            }

            const earned = Boolean(team.bonus_torcida);
            const bonus = earned ? BONUS_TORCIDA_POINTS : 0;
            total.min += bonus - team.penalty_points;
            total.max += bonus - team.penalty_points;

            return {
                id: team.id,
                name: team.name,
                modalities: cells,
                bonus_torcida: { earned, points: bonus },
                penalty_points: team.penalty_points,
                total,
            };
        }),
    };
}
