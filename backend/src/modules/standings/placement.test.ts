import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BONUS_TORCIDA_POINTS, computePlacements, pointsFor, scoreBracket, StandingsError, type BracketInput, type Range } from "./placement";

/** Shorthand for a match row: `m(id, round, a, b, winner?, walkover?)`. */
function m(id: number, round: number, a: number | null, b: number | null, winner: number | null = null, walkover = false): BracketInput {
    return { id, round, team_a_id: a, team_b_id: b, winner_id: winner, walkover };
}

const r = (min: number, max: number = min): Range => ({ min, max });

function positions(matches: BracketInput[]): Record<number, Range> {
    return Object.fromEntries(computePlacements(matches).map((p) => [p.team_id, p.position]));
}

/**
 * 8-team bracket, fully played. Teams are numbered 1..8 top to bottom.
 *   QF: 1>2, 3>4, 5>6, 7>8   SF: 1>3, 7>5   F: 1>7
 */
const FINISHED_8 = [
    m(1, 1, 1, 2, 1), m(2, 1, 3, 4, 3), m(3, 1, 5, 6, 5), m(4, 1, 7, 8, 7),
    m(5, 2, 1, 3, 1), m(6, 2, 5, 7, 7),
    m(7, 3, 1, 7, 1),
];

describe("computePlacements", () => {
    it("places every team of a finished bracket by who eliminated it", () => {
        assert.deepEqual(positions(FINISHED_8), {
            1: r(1), // champion
            7: r(2), // runner-up
            3: r(3), // lost the semifinal to the champion
            5: r(4), // lost the semifinal to the runner-up
            2: r(5), // lost the quarterfinal to the champion
            8: r(6), // lost the quarterfinal to the runner-up
            4: r(7), // lost the quarterfinal to the 3rd
            6: r(8), // lost the quarterfinal to the 4th
        });
        const champion = computePlacements(FINISHED_8).find((p) => p.team_id === 1)!;
        assert.equal(champion.status, "champion");
        const sixth = computePlacements(FINISHED_8).find((p) => p.team_id === 8)!;
        assert.equal(sixth.status, "eliminated");
        assert.equal(sixth.eliminated_by, 7);
    });

    it("gives ranges while the bracket is in progress", () => {
        // Quarterfinals played, first semifinal played (1 > 3), second semifinal and final pending.
        const matches = [
            m(1, 1, 1, 2, 1), m(2, 1, 3, 4, 3), m(3, 1, 5, 6, 5), m(4, 1, 7, 8, 7),
            m(5, 2, 1, 3, 1), m(6, 2, 5, 7),
            m(7, 3, 1, null),
        ];
        assert.deepEqual(positions(matches), {
            1: r(1, 2), // in the final
            5: r(1, 4), // still in the semifinal
            7: r(1, 4),
            3: r(3, 4), // lost to a finalist: 3rd if 1 wins the final, 4th otherwise
            2: r(5, 6), // lost to 1, who finishes 1st or 2nd
            4: r(7, 8), // lost to 3, who finishes 3rd or 4th
            6: r(5, 8), // lost to a team still in the semifinal
            8: r(5, 8),
        });
    });

    it("has every team between 1st and last before any match is played", () => {
        const matches = [
            m(1, 1, 1, 2), m(2, 1, 3, 4), m(3, 1, 5, 6), m(4, 1, 7, 8),
            m(5, 2, null, null), m(6, 2, null, null),
            m(7, 3, null, null),
        ];
        const all = computePlacements(matches);
        assert.equal(all.length, 8);
        for (const p of all) {
            assert.equal(p.status, "alive");
            assert.deepEqual(p.position, r(1, 8));
        }
    });

    it("handles byes: nobody can finish below the number of teams", () => {
        // 6 teams in an 8-slot bracket: 5 and 6 skip the first round.
        const matches = [
            m(1, 1, 1, 2, 1), m(2, 1, 3, 4, 3),
            m(3, 2, 5, 1), m(4, 2, 6, 3),
            m(5, 3, null, null),
        ];
        assert.deepEqual(positions(matches), {
            1: r(1, 4), 3: r(1, 4), 5: r(1, 4), 6: r(1, 4),
            2: r(5, 6), 4: r(5, 6),
        });

        // Then 5 > 1, 3 > 6 and 5 > 3 in the final.
        const finished = [
            m(1, 1, 1, 2, 1), m(2, 1, 3, 4, 3),
            m(3, 2, 5, 1, 5), m(4, 2, 6, 3, 3),
            m(5, 3, 5, 3, 5),
        ];
        assert.deepEqual(positions(finished), {
            5: r(1), 3: r(2),
            1: r(3), // lost the semifinal to the champion
            6: r(4), // lost the semifinal to the runner-up
            4: r(5), // lost the first round to 3 (2nd), the best-placed first-round winner
            2: r(6), // lost the first round to 1 (3rd)
        });
    });

    it("flags walkover losses without moving anyone up", () => {
        const matches = FINISHED_8.map((x) => (x.id === 7 ? { ...x, walkover: true } : x));
        const runnerUp = computePlacements(matches).find((p) => p.team_id === 7)!;
        assert.deepEqual(runnerUp.position, r(2));
        assert.equal(runnerUp.walkover_loss, true);
        const third = computePlacements(matches).find((p) => p.team_id === 3)!;
        assert.deepEqual(third.position, r(3));
        assert.equal(third.walkover_loss, false);
    });

    it("returns nothing for a modality without a bracket", () => {
        assert.deepEqual(computePlacements([]), []);
    });
});

describe("pointsFor", () => {
    it("follows the PONTUACAO.md tables", () => {
        assert.deepEqual(pointsFor(9, r(1), false), r(13));
        assert.deepEqual(pointsFor(9, r(9), false), r(1));
        assert.deepEqual(pointsFor(8, r(3), false), r(7));
        assert.deepEqual(pointsFor(3, r(2), false), r(3));
    });

    it("inverts position ranges into point ranges", () => {
        assert.deepEqual(pointsFor(8, r(3, 4), false), r(6, 7));
        assert.deepEqual(pointsFor(6, r(5, 6), false), r(1, 2));
        assert.deepEqual(pointsFor(8, r(1, 8), false), r(1, 12));
    });

    it("scores nothing for a walkover loss", () => {
        assert.deepEqual(pointsFor(8, r(2), true), r(0));
    });

    it("does not score modalities with fewer than 3 teams", () => {
        assert.equal(pointsFor(2, r(1), false), null);
    });

    it("rejects more than 9 teams", () => {
        assert.throws(() => pointsFor(10, r(1), false), StandingsError);
    });

    it("values the supporters bonus at 2 points", () => {
        assert.equal(BONUS_TORCIDA_POINTS, 2);
    });
});

describe("scoreBracket", () => {
    it("combines placements and points", () => {
        const standings = scoreBracket(FINISHED_8);
        assert.equal(standings.team_count, 8);
        assert.equal(standings.finished, true);
        const byTeam = Object.fromEntries(standings.placements.map((p) => [p.team_id, p.points]));
        assert.deepEqual(byTeam, { 1: r(12), 7: r(9), 3: r(7), 5: r(6), 2: r(4), 8: r(3), 4: r(2), 6: r(1) });
    });

    it("is unfinished until the final has a winner", () => {
        const matches = FINISHED_8.map((x) => (x.id === 7 ? { ...x, winner_id: null } : x));
        assert.equal(scoreBracket(matches).finished, false);
    });

    it("keeps positions but no points for a 2-team bracket", () => {
        const standings = scoreBracket([m(1, 1, 1, 2, 1)]);
        assert.equal(standings.team_count, 2);
        assert.deepEqual(standings.placements.map((p) => [p.team_id, p.position, p.points]), [[1, r(1), null], [2, r(2), null]]);
    });

    it("throws for brackets with more than 9 teams", () => {
        // 10 teams in a 16-slot bracket: two first-round matches, six byes.
        const matches = [
            m(1, 1, 1, 2), m(2, 1, 3, 4),
            m(3, 2, 5, null), m(4, 2, 6, null), m(5, 2, 7, 8), m(6, 2, 9, 10),
            m(7, 3, null, null), m(8, 3, null, null),
            m(9, 4, null, null),
        ];
        assert.throws(() => scoreBracket(matches), StandingsError);
    });
});
