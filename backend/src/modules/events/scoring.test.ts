import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StandingsError, type Range } from "../standings/placement";
import { athletesPerTeam, computeEventsPlacements, eventEntries, eventPoints, maxEventPoints, scoreEvents, type EventInput } from "./scoring";

const r = (min: number, max: number = min): Range => ({ min, max });

const NORMAL = { demonstrativa: false, revezamento: false };
const RELAY = { demonstrativa: false, revezamento: true };
const DEMO = { demonstrativa: true, revezamento: false };

/** Shorthand for an event: `e(id, flags, finished, [1st, 2nd, ...])` where the array lists the team of each position (null = empty). */
function e(id: number, flags: typeof NORMAL, finished: boolean, positions: (number | null)[] = []): EventInput {
    return {
        id,
        ...flags,
        finished,
        results: positions.flatMap((team, index) => (team === null ? [] : [{ team_id: team, position: index + 1 }])),
    };
}

function by<T extends keyof ReturnType<typeof computeEventsPlacements>[number]>(teamIds: number[], events: EventInput[], field: T) {
    return Object.fromEntries(computeEventsPlacements(teamIds, events).map((p) => [p.team_id, p[field]]));
}

const FOUR = [1, 2, 3, 4];

describe("eventPoints", () => {
    it("follows the PONTUACAO.md table for the number of teams in the event", () => {
        assert.equal(eventPoints(9, 1, NORMAL), 13);
        assert.equal(eventPoints(4, 3, NORMAL), 2);
        assert.equal(eventPoints(4, 5, NORMAL), 0); // past the table
    });

    it("doubles a relay and zeroes a demonstration, even a relay one", () => {
        assert.equal(eventPoints(4, 1, RELAY), 12);
        assert.equal(eventPoints(4, 1, DEMO), 0);
        assert.equal(eventPoints(4, 1, { demonstrativa: true, revezamento: true }), 0);
    });

    it("uses the 3-team table for the internal ranking of smaller events", () => {
        assert.equal(eventPoints(2, 1, NORMAL), 5);
    });

    it("rejects more than 9 teams", () => {
        assert.throws(() => eventPoints(10, 1, NORMAL), StandingsError);
    });

    it("allows two athletes per team, one in a relay", () => {
        assert.equal(athletesPerTeam(NORMAL), 2);
        assert.equal(athletesPerTeam(RELAY), 1);
    });

    it("bounds an open event by the first place among the registered teams", () => {
        assert.equal(maxEventPoints(4, NORMAL), 6);
        assert.equal(maxEventPoints(9, RELAY), 26);
        assert.equal(maxEventPoints(2, NORMAL), 5);
    });
});

describe("eventEntries", () => {
    it("lets only the best athlete of each team take a place", () => {
        // Team 1 took 1st and 2nd; team 2 is then 2nd among the teams, team 3 is 3rd.
        const entries = eventEntries(e(1, NORMAL, true, [1, 1, 2, 3, 2]));
        assert.deepEqual(
            entries.map((x) => [x.team_id, x.position, x.scores, x.place]),
            [[1, 1, true, 1], [1, 2, false, null], [2, 3, true, 2], [3, 4, true, 3], [2, 5, false, null]],
        );
    });

    it("scores by the number of teams in the event once it is finished", () => {
        // 3 teams took part (5, 3, 1), whatever the modality has.
        const points = eventEntries(e(1, NORMAL, true, [1, 1, 2, 3, 2])).map((x) => x.points);
        assert.deepEqual(points, [5, null, 3, 1, null]);
    });

    it("has no points while the event is open", () => {
        assert.deepEqual(eventEntries(e(1, NORMAL, false, [1, 2])).map((x) => x.points), [null, null]);
    });

    it("compacts empty positions", () => {
        assert.deepEqual(eventEntries(e(1, NORMAL, true, [1, null, 2])).map((x) => x.place), [1, 2]);
    });
});

describe("computeEventsPlacements", () => {
    it("sums the event points into the internal score and ranks by it", () => {
        // Two finished events with the 4 teams: table [6, 4, 2, 1].
        const events = [e(1, NORMAL, true, [1, 2, 3, 4]), e(2, NORMAL, true, [2, 1, 4, 3])];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(10), 2: r(10), 3: r(3), 4: r(3) });
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1), 2: r(1), 3: r(3), 4: r(3) }); // ties share the position
        assert.deepEqual(by(FOUR, events, "points"), { 1: r(6), 2: r(6), 3: r(2), 4: r(2) });
        assert.deepEqual(by(FOUR, events, "status"), { 1: "champion", 2: "champion", 3: "eliminated", 4: "eliminated" });
    });

    it("scores each event by the teams that took part in it", () => {
        // Only 3 of the 4 registered teams ran: table [5, 3, 1]; the 4th scores nothing.
        const events = [e(1, NORMAL, true, [1, 2, 3])];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(5), 2: r(3), 3: r(1), 4: r(0) });
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1), 2: r(2), 3: r(3), 4: r(4) });
    });

    it("counts a team once per event, by its best athlete", () => {
        // Team 1 took 1st and 2nd: it scores 1st of 3 teams (5), team 2 is 2nd (3), team 3 is 3rd (1).
        const events = [e(1, NORMAL, true, [1, 1, 2, 3])];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(5), 2: r(3), 3: r(1), 4: r(0) });
        const first = computeEventsPlacements(FOUR, events).find((p) => p.team_id === 1)!;
        assert.deepEqual(first.events, { 1: { position: 1, points: 5 } });
    });

    it("doubles relays and ignores demonstrations", () => {
        const events = [e(1, RELAY, true, [1, 2, 3, 4]), e(2, DEMO, true, [4, 3, 2, 1])];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(12), 2: r(8), 3: r(4), 4: r(2) });
        const first = computeEventsPlacements(FOUR, events).find((p) => p.team_id === 1)!;
        assert.deepEqual(first.events, { 1: { position: 1, points: 12 }, 2: { position: 4, points: 0 } });
    });

    it("keeps every team's range open until the event is finished, whatever is recorded", () => {
        // Event 1 done; event 2 has every position filled but is still open; event 3 not started.
        const events = [e(1, NORMAL, true, [1, 2, 3, 4]), e(2, NORMAL, false, [3, 4, 1, 2]), e(3, RELAY, false)];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(6, 6 + 6 + 12), 2: r(4, 4 + 18), 3: r(2, 2 + 18), 4: r(1, 1 + 18) });
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1, 4), 2: r(1, 4), 3: r(1, 4), 4: r(1, 4) });
        assert.deepEqual(by(FOUR, events, "status"), { 1: "alive", 2: "alive", 3: "alive", 4: "alive" });
        const first = computeEventsPlacements(FOUR, events).find((p) => p.team_id === 1)!;
        assert.deepEqual(first.events, { 1: { position: 1, points: 6 }, 2: null, 3: null });
    });

    it("narrows the ranges as the scores separate", () => {
        // Team 1 won the three finished events; one event left (6 points at most): 2 can only tie 1, 4 cannot pass 2.
        const done = [e(1, NORMAL, true, [1, 2, 3, 4]), e(2, NORMAL, true, [1, 2, 3, 4]), e(3, NORMAL, true, [1, 2, 3, 4])];
        const events = [...done, e(4, NORMAL, false)];
        assert.deepEqual(by(FOUR, events, "score"), { 1: r(18, 24), 2: r(12, 18), 3: r(6, 12), 4: r(3, 9) });
        // 1 is not safe yet: 2 can tie it, and ties only share the position once everything is finished.
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1, 2), 2: r(1, 3), 3: r(2, 4), 4: r(3, 4) });
        assert.deepEqual(by(FOUR, events, "points"), { 1: r(4, 6), 2: r(2, 6), 3: r(1, 4), 4: r(1, 2) });
    });

    it("shares the position on a tie only once everything is finished", () => {
        const events = [e(1, NORMAL, true, [1, 2, 3, 4]), e(2, NORMAL, true, [2, 1, 4, 3]), e(3, DEMO, false)];
        assert.deepEqual(by(FOUR, events, "position"), { 1: r(1, 2), 2: r(1, 2), 3: r(3, 4), 4: r(3, 4) });
        const closed = events.map((x) => ({ ...x, finished: true }));
        assert.deepEqual(by(FOUR, closed, "position"), { 1: r(1), 2: r(1), 3: r(3), 4: r(3) });
    });

    it("leaves every team between 1st and last while there are no events", () => {
        assert.deepEqual(by(FOUR, [], "position"), { 1: r(1, 4), 2: r(1, 4), 3: r(1, 4), 4: r(1, 4) });
    });

    it("has every team between 1st and last before anything is recorded", () => {
        for (const p of computeEventsPlacements(FOUR, [e(1, NORMAL, false)])) {
            assert.deepEqual(p.position, r(1, 4));
            assert.deepEqual(p.points, r(1, 6));
        }
    });

    it("does not score modalities with fewer than 3 teams", () => {
        assert.deepEqual(by([1, 2], [e(1, NORMAL, true, [1, 2])], "points"), { 1: null, 2: null });
        assert.deepEqual(by([1, 2], [e(1, NORMAL, true, [1, 2])], "position"), { 1: r(1), 2: r(2) });
    });

    it("returns nothing for a modality without registrations", () => {
        assert.deepEqual(computeEventsPlacements([], [e(1, NORMAL, true)]), []);
    });
});

describe("scoreEvents", () => {
    it("is finished once every event is finished", () => {
        assert.equal(scoreEvents(FOUR, []).finished, false);
        assert.equal(scoreEvents(FOUR, [e(1, NORMAL, true), e(2, NORMAL, false)]).finished, false);
        assert.equal(scoreEvents(FOUR, [e(1, NORMAL, true), e(2, NORMAL, true)]).finished, true);
    });

    it("throws for more than 9 teams", () => {
        assert.throws(() => scoreEvents([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [e(1, NORMAL, false)]), StandingsError);
    });
});
