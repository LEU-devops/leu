import { db } from "../../services/db";
import { isEventsModality, type Modality, type ModalityType } from "../../types/competition";
import { loadEvents, scoreOrError, type EventWithResults } from "../events/controller";
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

type ScoredModality = { column: StandingsModality; cells: Map<number, StandingsCell> };

function emptyColumn(modality: Modality): StandingsModality {
    return { code: modality.code, name: modality.name, type: modality.type, team_count: 0, finished: false, error: null };
}

/** One row of the standings table. */
export interface StandingsTeam {
    id: number;
    name: string;
    /** By modality code. null = nothing to compute: not registered, bracket not created or modality not scored. */
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

/** Cells of a bracket modality by team id, with the column metadata. */
function scoreBracketModality(modality: Modality, matches: BracketInput[]): ScoredModality {
    const column = emptyColumn(modality);
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

/** Cells of an events modality (atletismo, natação): the final classification by internal score. */
function scoreEventsModality(modality: Modality, teamIds: number[], events: EventWithResults[]): ScoredModality {
    const column = emptyColumn(modality);
    const cells = new Map<number, StandingsCell>();
    if (teamIds.length === 0)
        return { column, cells };

    const { standings, error } = scoreOrError(teamIds, events);
    column.team_count = teamIds.length;
    if (!standings) {
        column.error = error;
        return { column, cells };
    }
    column.finished = standings.finished;
    for (const p of standings.placements)
        cells.set(p.team_id, { position: p.position, points: p.points, status: p.status, eliminated_by: null, walkover_loss: false });
    return { column, cells };
}

/** The whole standings table: every team against every modality, with bonus, penalty and totals. */
export async function getStandings(): Promise<Standings> {
    const [modalities, teams, matches, registrations] = await Promise.all([
        db("modalities").select("*").orderBy("name"),
        db("teams").select("*").orderBy("name"),
        db("matches").select("id", "modality_code", "round", "team_a_id", "team_b_id", "winner_id", "walkover"),
        db("registrations").select("*"),
    ]);
    const eventsByModality = await loadEvents(db, modalities.filter((m) => isEventsModality(m.type)).map((m) => m.code));

    const scored = modalities.map((modality) =>
        isEventsModality(modality.type)
            ? scoreEventsModality(
                  modality,
                  registrations.filter((r) => r.modality_code === modality.code).map((r) => r.team_id),
                  eventsByModality.get(modality.code) ?? [],
              )
            : scoreBracketModality(
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
