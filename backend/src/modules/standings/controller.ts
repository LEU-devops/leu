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
    /** The code people see ("FM"); `code` is the internal key. */
    short_code: string;
    name: string;
    type: ModalityType;
    team_count: number;
    finished: boolean;
    /** Set when the modality could not be scored (e.g. more teams than the tables cover); its cells are null. */
    error: string | null;
}

type ScoredModality = { column: StandingsModality; cells: Map<number, StandingsCell> };

function emptyColumn(modality: Modality): StandingsModality {
    return { code: modality.code, short_code: modality.short_code, name: modality.name, type: modality.type, team_count: 0, finished: false, error: null };
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

/**
 * The standings table of one edition: every team that takes part in it (in a bracket, a
 * registration or with a scoring adjustment) against every modality, with bonus, penalty and totals.
 */
export async function getStandings(editionId: number): Promise<Standings> {
    const modalities = await db("modalities").where({ edition_id: editionId }).select("*").orderBy("name");
    const codes = modalities.map((modality) => modality.code);
    const [matches, registrations, scoring] = await Promise.all([
        db("matches").whereIn("modality_code", codes).select("id", "modality_code", "round", "team_a_id", "team_b_id", "winner_id", "walkover"),
        db("registrations").whereIn("modality_code", codes).select("*"),
        db("edition_team_scoring").where({ edition_id: editionId }).select("*"),
    ]);
    const teamIds = new Set<number>([
        ...matches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((id): id is number => id !== null),
        ...registrations.map((r) => r.team_id),
        ...scoring.map((s) => s.team_id),
    ]);
    const teams = await db("teams").whereIn("id", [...teamIds]).select("*").orderBy("name");
    const scoringByTeam = new Map(scoring.map((s) => [s.team_id, s]));
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

            const adjustment = scoringByTeam.get(team.id);
            const earned = Boolean(adjustment?.bonus_torcida);
            const penalty = adjustment?.penalty_points ?? 0;
            const bonus = earned ? BONUS_TORCIDA_POINTS : 0;
            total.min += bonus - penalty;
            total.max += bonus - penalty;

            return {
                id: team.id,
                name: team.name,
                modalities: cells,
                bonus_torcida: { earned, points: bonus },
                penalty_points: penalty,
                total,
            };
        }),
    };
}
