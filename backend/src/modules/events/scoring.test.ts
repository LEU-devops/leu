import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StandingsError, type Range } from "../standings/placement";
import { computeEventsPlacements, eventPoints, scoreEvents, type EventInput } from "./scoring";

const r = (min: number, max: number = min): Range => ({ min, max });

/** Shorthand for an event: `e(id, kind, finished, [1st, 2nd, ...])` where the array lists the team in each position (null = empty). */
function e(id: number, kind: EventInput["kind"], finished: boolean, positions: (number | null)[] = []): EventInput {
    return {
        id,
        kind,
        finished,
        results: positions.flatMap((team, index) => (team === null ? [] : [{ team_id: team, position: index + 1 }])),
    };
}

function by<T extends keyof ReturnType<typeof computeEventsPlacements>[number]>(teamIds: number[], events: EventInput[], field: T) {
    return Object.fromEntries(computeEventsPlacements(teamIds, events).map((p) => [p.team_id, p[field]]));
}

const FOUR = [1, 2, 3, 4];

describe("eventPoints", () => {
    it("follows the PONTUACAO.md table for the number of registered teams", () => {
        assert.equal(eventPoints(9, 1, "normal"), 13);
        assert.equal(eventPoints(4, 3, "normal"), 2);
        assert.equal(eventPoints(4, 5, "normal"), 0); // past the table
    });

    it("doubles a relay and zeroes a demonstration", () => {
        assert.equal(eventPoints(4, 1, "revezamento"), 12);
        assert.equal(eventPoints(4, 1, "demonstrativa"), 0);
    });

    it("uses the 3-team table for the internal ranking of smaller modalities", () => {
        assert.equal(eventPoints(2, 1, "normal"), 5);
    });

    it("rejects more than 9 teams", () => {
        assert.throws(() => eventPoints(10, 1, "normal"), StandingsError);
    });
});

describe("computeEventsPlacements", () => {
    it("sums the event points into the internal score and ranks by it", () => {
        // 4 teams: table [6, 4, 2, 1]. Two finished events.
        const events = [e(1, "normal", true, [1, 2, 3, 4]), e(2, "normal", true, [2, 1, 4, 3])];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(10), 2: r(10), 3: r(3), 4: r(3) });
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1), 2: r(1), 3: r(3), 4: r(3) }); // ties share the position
        assert.deepEqual(by(FOUR, events, "points"), { 1: r(6), 2: r(6), 3: r(2), 4: r(2) });
        assert.deepEqual(by(FOUR, events, "status"), { 1: "champion", 2: "champion", 3: "eliminated", 4: "eliminated" });
    });

    it("doubles relays and ignores demonstrations", () => {
        const events = [e(1, "revezamento", true, [1, 2, 3, 4]), e(2, "demonstrativa", true, [4, 3, 2, 1])];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(12), 2: r(8), 3: r(4), 4: r(2) });
        const first = computeEventsPlacements(FOUR, events).find((p) => p.team_id === 1)!;
        assert.deepEqual(first.events, { 1: { position: 1, points: 12 }, 2: { position: 4, points: 0 } });
    });

    it("gives ranges while events are open", () => {
        // Event 1 done; event 2 has only the winner so far; event 3 not started.
        const events = [e(1, "normal", true, [1, 2, 3, 4]), e(2, "normal", false, [3]), e(3, "normal", false)];
        assert.deepEqual(by(FOUR, events, "score"), {
            1: r(6, 6 + 4 + 6), // 2nd is the best still free in event 2
            2: r(4, 4 + 4 + 6),
            3: r(2 + 6, 8 + 6),   // already placed in event 2
            4: r(1, 1 + 4 + 6),
        });
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1, 4), 2: r(1, 4), 3: r(1, 4), 4: r(1, 4) });
        assert.deepEqual(by(FOUR, events, "status"), { 1: "alive", 2: "alive", 3: "alive", 4: "alive" });
    });

    it("narrows the ranges as the scores separate", () => {
        // Team 1 won the three finished events; one event left (6 points at most): 2 can only tie 1, 4 cannot pass 2.
        const done = [e(1, "normal", true, [1, 2, 3, 4]), e(2, "normal", true, [1, 2, 3, 4]), e(3, "normal", true, [1, 2, 3, 4])];
        const events = [...done, e(4, "normal", false)];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(18, 24), 2: r(12, 18), 3: r(6, 12), 4: r(3, 9) });
        // 1 is not safe yet: 2 can tie it, and ties only share the position once everything is finished.
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1, 2), 2: r(1, 3), 3: r(2, 4), 4: r(3, 4) });
        assert.deepEqual(by(FOUR, events, "points"), { 1: r(4, 6), 2: r(2, 6), 3: r(1, 4), 4: r(1, 2) });
    });

    it("shares the position on a tie only once everything is finished", () => {
        const events = [e(1, "normal", true, [1, 2, 3, 4]), e(2, "normal", true, [2, 1, 4, 3]), e(3, "demonstrativa", false)];
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1, 2), 2: r(1, 2), 3: r(3, 4), 4: r(3, 4) });
        const closed = events.map((x) => ({ ...x, finished: true }));
        assert.deepEqual(by(FOUR, closed, "position"), { 1: r(1), 2: r(1), 3: r(3), 4: r(3) });
    });

    it("leaves every team between 1st and last while there are no events", () => {
        assert.deepEqual(by(FOUR, [], "position"), { 1: r(1, 4), 2: r(1, 4), 3: r(1, 4), 4: r(1, 4) });
    });

    it("does not count a finished event with empty positions as available points", () => {
        const events = [e(1, "normal", true, [1, 2])]; // 3rd and 4th never showed up
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(6), 2: r(4), 3: r(0), 4: r(0) });
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1), 2: r(2), 3: r(3), 4: r(3) });
    });

    it("has every team between 1st and last before anything is recorded", () => {
        for (const p of computeEventsPlacements(FOUR, [e(1, "normal", false)])) {
            assert.deepEqual(p.position, r(1, 4));
            assert.deepEqual(p.points, r(1, 6));
        }
    });

    it("does not score modalities with fewer than 3 teams", () => {
        assert.deepEqual(by([1, 2], [e(1, "normal", true, [1, 2])], "points"), { 1: null, 2: null });
        assert.deepEqual(by([1, 2], [e(1, "normal", true, [1, 2])], "position"), { 1: r(1), 2: r(2) });
    });

    it("returns nothing for a modality without registrations", () => {
        assert.deepEqual(computeEventsPlacements([], [e(1, "normal", true)]), []);
    });
});

describe("scoreEvents", () => {
    it("is finished once every event is finished", () => {
        assert.equal(scoreEvents(FOUR, []).finished, false);
        assert.equal(scoreEvents(FOUR, [e(1, "normal", true), e(2, "normal", false)]).finished, false);
        assert.equal(scoreEvents(FOUR, [e(1, "normal", true), e(2, "normal", true)]).finished, true);
    });

    it("throws for more than 9 teams", () => {
        assert.throws(() => scoreEvents([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [e(1, "normal", true, [1])]), StandingsError);
    });
});
