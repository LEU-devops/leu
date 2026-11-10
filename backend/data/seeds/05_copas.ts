import type { Knex } from "knex";
import { createEvent, setEventResults, setRegistrations, updateEvent } from "../../src/modules/events/controller";
import { createBracket, getBracket, setMatchResult, setMatchSchedule } from "../../src/modules/modalities/controller";
import { addParticipationAward, setCopaAthletes } from "../../src/modules/participations/controller";
import { closeEdition, setResults } from "../../src/modules/results/controller";
import { updateTeam } from "../../src/modules/teams/controller";
import type { Modality, ModalityRef } from "../../src/types/competition";
import { AAAS, DEV_EMAIL, email, ORG, type PersonKey, syncSequences } from "../seed-utils";

/**
 * The Copas, from the catalog to the champions history:
 *  - Copa Eng 2026 (current): brackets in progress (finals to play, a W.O., byes), scheduled
 *    matches with venues and neutral teams, atletismo and natação events, bonus and penalty.
 *  - Copa Bixo 2026: fully played, then closed (its live standings become the saved results).
 *  - InterGestões 2026: results typed in, without brackets (the LEU plays too).
 *  - Copa Eng 2023–2025 and Copa Bixo 2025: only their saved results, like old editions logged
 *    afterwards. Until 2024 the AAAFEE played as "FEEC" (name per edition).
 * Brackets, events, results and Copa participations go through the app's controllers.
 */

const CUP = { ENG: 1, BIXO: 2, INTER: 3 } as const;
const ED = { ENG_2026: 1, BIXO_2026: 2, INTER_2026: 3, ENG_2025: 4, ENG_2024: 5, ENG_2023: 6, BIXO_2025: 7 } as const;

const MODALITIES = [
    { code: "BM", name: "Basquete Masculino", type: "chaveamento" },
    { code: "BF", name: "Basquete Feminino", type: "chaveamento" },
    { code: "FM", name: "Futsal Masculino", type: "chaveamento" },
    { code: "FF", name: "Futsal Feminino", type: "chaveamento" },
    { code: "VM", name: "Vôlei Masculino", type: "chaveamento" },
    { code: "VF", name: "Vôlei Feminino", type: "chaveamento" },
    { code: "HM", name: "Handebol Masculino", type: "chaveamento" },
    { code: "HF", name: "Handebol Feminino", type: "chaveamento" },
    { code: "TMM", name: "Tênis de Mesa Masculino", type: "chaveamento" },
    { code: "TMF", name: "Tênis de Mesa Feminino", type: "chaveamento" },
    { code: "TM", name: "Tênis Campo Masculino", type: "chaveamento" },
    { code: "TF", name: "Tênis Campo Feminino", type: "chaveamento" },
    { code: "XA", name: "Xadrez Absoluto", type: "chaveamento" },
    { code: "ATM", name: "Atletismo Masculino", type: "atletismo" },
    { code: "ATF", name: "Atletismo Feminino", type: "atletismo" },
    { code: "NTA", name: "Natação Absoluto", type: "natacao" },
    { code: "NTF", name: "Natação Feminino", type: "natacao" },
    { code: "NTM", name: "Natação Masculino", type: "natacao" },
] satisfies Modality[];
const ALL_CODES = MODALITIES.map((m) => m.code);
const BIXO_CODES = ["FM", "FF", "VM", "VF", "BM", "BF", "HM", "HF", "ATM", "ATF"];

const VENUE = { VOLEI_Q1: 6, VOLEI_Q2: 7, BASQUETE_Q1: 9, BASQUETE_Q2: 10, FUT_Q1: 12, FUT_Q2: 13, PISTA: 18, PISCINA: 20 } as const;
const VENUES = [
    { id: 1, name: "FEF", parent_id: null },
    { id: 2, name: "Ginásio Multidisciplinar", parent_id: null },
    { id: 3, name: "Vôlei", parent_id: 1 },
    { id: 4, name: "Basquete", parent_id: 1 },
    { id: 5, name: "Fut/Hand", parent_id: 1 },
    { id: 6, name: "Q1", parent_id: 3 },
    { id: 7, name: "Q2", parent_id: 3 },
    { id: 8, name: "Q3", parent_id: 3 },
    { id: 9, name: "Q1", parent_id: 4 },
    { id: 10, name: "Q2", parent_id: 4 },
    { id: 11, name: "Q3", parent_id: 4 },
    { id: 12, name: "Q1", parent_id: 5 },
    { id: 13, name: "Q2", parent_id: 5 },
    { id: 14, name: "Q3", parent_id: 5 },
    { id: 17, name: "Aquário", parent_id: 1 },
    { id: 18, name: "Pista", parent_id: 1 },
    { id: 19, name: "Tênis", parent_id: 1 },
    { id: 20, name: "Piscina", parent_id: 1 },
    { id: 21, name: "Q1", parent_id: 19 },
    { id: 22, name: "Q2", parent_id: 19 },
];

/** Copa Eng 2026 runs Nov 7–9; times in Brasília (UTC-3). */
const DAYS_2026 = ["2026-11-07", "2026-11-08", "2026-11-09"];
const HOURS = ["08:00", "09:30", "11:00", "13:30", "15:00", "16:30", "18:00", "19:30"];
function at(day: string, hour: string): string {
    return new Date(`${day}T${hour}:00-03:00`).toISOString();
}

const { KI, ECA, ETA, FEA, FEAGRI, FEE, FEQ, MEC, XD, LEU } = ORG;
const SHORT: Record<number, string> = { [KI]: "KI", [ECA]: "ECA", [ETA]: "ETA", [FEA]: "FEA", [FEAGRI]: "FEAGRI", [FEE]: "FEE", [FEQ]: "FEQ", [MEC]: "MEC", [XD]: "XD", [LEU]: "LEU" };
const BIXO_TEAMS = [FEE, FEA, KI, MEC, XD, FEQ];

/** [score A, score B, winner, walkover?] of a match; null = not played yet (or no match: a bye). */
type Score = [string, string, "a" | "b", boolean?] | null;

/** Creates a bracket and plays the given results round by round (`rounds[0]` = first round, by position). */
async function bracket(editionId: number, code: string, slots: (number | null)[], rounds: Score[][] = []): Promise<ModalityRef> {
    const ref = { editionId, code };
    await createBracket(ref, slots);
    for (const [index, scores] of rounds.entries()) {
        for (const [position, score] of scores.entries()) {
            if (!score) continue;
            const match = (await getBracket(ref)).find((m) => m.round === index + 1 && m.position === position)!;
            await setMatchResult(ref, match.id, { scoreA: score[0], scoreB: score[1], winner: score[2], walkover: score[3] ?? false });
        }
    }
    return ref;
}

/** When and where a match is played, and its neutral teams. */
async function schedule(ref: ModalityRef, round: number, position: number, when: string, venueId: number, redator: number | null, mesario: number | null) {
    const match = (await getBracket(ref)).find((m) => m.round === round && m.position === position)!;
    await setMatchSchedule(ref, match.id, { scheduledAt: when, venueId, redatorTeamId: redator, mesarioTeamId: mesario });
}

interface EventSpec {
    name: string;
    demonstrativa?: boolean;
    revezamento?: boolean;
    /** Team ids by position (first = winner); a team may appear twice (once in a relay). */
    positions: (number | null)[];
    finished: boolean;
}

/** Registers the teams of an events modality and creates its events with their results. */
async function events(editionId: number, code: string, teams: number[], specs: EventSpec[]) {
    const ref = { editionId, code };
    await setRegistrations(ref, { teamIds: teams });
    for (const spec of specs) {
        const view = await createEvent(ref, { name: spec.name, demonstrativa: spec.demonstrativa ?? false, revezamento: spec.revezamento ?? false });
        const event = view.events.find((e) => e.name === spec.name)!;
        await setEventResults(ref, event.id, { positions: spec.positions });
        if (spec.finished) await updateEvent(ref, event.id, { finished: true });
    }
}

/** Typed-in results of an edition: overall (with points when given) and some modalities. */
async function logResults(editionId: number, overall: (number | [number, number])[], modalities: Record<string, number[]>) {
    await setResults(editionId, {
        scope: "overall",
        entries: overall.map((item, index) => (Array.isArray(item)
            ? { organizationId: item[0], position: index + 1, points: item[1] }
            : { organizationId: item, position: index + 1 })),
    });
    for (const [code, order] of Object.entries(modalities))
        await setResults(editionId, { scope: code, entries: order.map((organizationId, index) => ({ organizationId, position: index + 1 })) });
}

/** Athletes of an AAA in a Copa modality, with awards given there. */
async function copaAthletes(editionId: number, code: string, organizationId: number, people: PersonKey[], awards: [string, PersonKey[]][] = []) {
    const participation = await setCopaAthletes(DEV_EMAIL, editionId, { modality_code: code, organization_id: organizationId, athletes: people.map(email) });
    for (const [title, recipients] of awards)
        await addParticipationAward(DEV_EMAIL, participation.id!, { title, recipients: recipients.map(email) });
}

export async function seed(knex: Knex): Promise<void> {
    // --- Catalog, venues, cups, editions ---
    await knex("modalities").insert(MODALITIES);
    await knex("venues").insert(VENUES);
    await knex("cups").insert([
        { id: CUP.ENG, name: "Copa Eng" },
        { id: CUP.BIXO, name: "Copa Bixo" },
        { id: CUP.INTER, name: "InterGestões" },
    ]);
    await knex("copa_editions").insert([
        { id: ED.ENG_2026, cup_id: CUP.ENG, year: 2026, name: null, is_current: true, finished: false },
        { id: ED.BIXO_2026, cup_id: CUP.BIXO, year: 2026, name: null, is_current: false, finished: false },
        { id: ED.INTER_2026, cup_id: CUP.INTER, year: 2026, name: null, is_current: false, finished: true },
        { id: ED.ENG_2025, cup_id: CUP.ENG, year: 2025, name: "Copa Eng 10 anos", is_current: false, finished: true },
        { id: ED.ENG_2024, cup_id: CUP.ENG, year: 2024, name: null, is_current: false, finished: true },
        { id: ED.ENG_2023, cup_id: CUP.ENG, year: 2023, name: null, is_current: false, finished: true },
        { id: ED.BIXO_2025, cup_id: CUP.BIXO, year: 2025, name: null, is_current: false, finished: true },
    ]);
    await syncSequences(knex, ["venues", "cups", "copa_editions"]);

    const withoutTennis = ALL_CODES.filter((code) => code !== "TM" && code !== "TF");
    const editionModalities: [number, string[]][] = [
        [ED.ENG_2026, ALL_CODES], [ED.ENG_2025, ALL_CODES], [ED.ENG_2024, ALL_CODES], [ED.ENG_2023, withoutTennis],
        [ED.BIXO_2026, BIXO_CODES], [ED.BIXO_2025, BIXO_CODES],
        [ED.INTER_2026, ["FM", "VM", "XA", "TMM"]],
    ];
    await knex("edition_modalities").insert(editionModalities.flatMap(([edition_id, codes]) => codes.map((modality_code) => ({ edition_id, modality_code }))));

    const team = (edition_id: number, organization_id: number, display_name = SHORT[organization_id]) => ({ edition_id, organization_id, display_name });
    await knex("edition_organizations").insert([
        ...[ED.ENG_2026, ED.ENG_2025].flatMap((edition) => AAAS.map((org) => team(edition, org))),
        ...[ED.ENG_2024, ED.ENG_2023].flatMap((edition) => AAAS.map((org) => team(edition, org, org === FEE ? "FEEC" : SHORT[org]))),
        ...[ED.BIXO_2026, ED.BIXO_2025].flatMap((edition) => BIXO_TEAMS.map((org) => team(edition, org))),
        ...[LEU, FEE, FEA, KI, MEC, XD].map((org) => team(ED.INTER_2026, org)),
    ]);

    await knex("time_slots").insert([
        ...DAYS_2026.flatMap((day) => HOURS.map((hour) => ({ edition_id: ED.ENG_2026, starts_at: at(day, hour) }))),
        ...["2026-03-14", "2026-03-15"].flatMap((day) => HOURS.slice(0, 6).map((hour) => ({ edition_id: ED.BIXO_2026, starts_at: at(day, hour) }))),
    ]);

    // --- Copa Eng 2026 (current, in progress) ---
    const mon = DAYS_2026[2]; // today: the last day

    // Futsal Masculino: quarterfinals and semifinals played, final today.
    const fm = await bracket(ED.ENG_2026, "FM", [FEE, ECA, FEA, ETA, KI, FEQ, MEC, XD], [
        [["4", "1", "a"], ["3", "3 (4)", "a"], ["2", "0", "a"], ["1", "2", "b"]],
        [["2", "1", "a"], ["0", "1", "b"]],
    ]);
    await schedule(fm, 3, 0, at(mon, "18:00"), VENUE.FUT_Q1, KI, MEC);

    // Vôlei Masculino: finished, with a W.O. in the quarterfinals.
    await bracket(ED.ENG_2026, "VM", [FEE, XD, MEC, FEAGRI, FEA, KI, ECA, ETA], [
        [["2", "0", "a"], ["W.O.", "", "a", true], ["1", "2", "b"], ["2", "1", "a"]],
        [["2", "1", "a"], ["0", "2", "b"]],
        [["2", "1", "a"]],
    ]);

    // Futsal Feminino: 6 teams (FEE and ECA skip the first round), one semifinal played.
    const ff = await bracket(ED.ENG_2026, "FF", [FEE, null, FEA, KI, MEC, XD, ECA, null], [
        [null, ["1", "2", "b"], ["3", "0", "a"], null],
        [["2", "0", "a"]],
    ]);
    await schedule(ff, 2, 1, at(mon, "09:30"), VENUE.FUT_Q2, FEA, KI);

    // Vôlei Feminino: semifinals played, final today.
    const vf = await bracket(ED.ENG_2026, "VF", [FEA, KI, FEE, XD], [[["2", "0", "a"], ["2", "1", "a"]]]);
    await schedule(vf, 2, 0, at(mon, "16:30"), VENUE.VOLEI_Q1, MEC, XD);

    // Basquete Masculino: half of the quarterfinals played, the rest on the schedule.
    const bm = await bracket(ED.ENG_2026, "BM", [MEC, ETA, FEE, FEQ, KI, FEAGRI, XD, FEA], [[["54", "38", "a"], ["41", "45", "b"]]]);
    await schedule(bm, 1, 2, at(mon, "08:00"), VENUE.BASQUETE_Q1, ECA, FEE);
    await schedule(bm, 1, 3, at(mon, "08:00"), VENUE.BASQUETE_Q2, MEC, ETA);

    // Handebol Masculino: nothing played yet.
    const hm = await bracket(ED.ENG_2026, "HM", [MEC, FEA, FEE, KI]);
    await schedule(hm, 1, 0, at(mon, "11:00"), VENUE.FUT_Q1, XD, ECA);
    await schedule(hm, 1, 1, at(mon, "13:30"), VENUE.FUT_Q1, ETA, FEQ);

    // Atletismo Masculino: three events closed, one in progress, one demonstration.
    await events(ED.ENG_2026, "ATM", [FEE, FEA, KI, MEC, XD, ECA], [
        { name: "100m rasos", positions: [FEE, KI, FEA, FEE, MEC, XD, ECA, KI], finished: true },
        { name: "400m", positions: [FEA, FEE, MEC, KI, FEA, XD], finished: true },
        { name: "Revezamento 4x100m", revezamento: true, positions: [FEE, FEA, KI, MEC, ECA, XD], finished: true },
        { name: "1500m", positions: [MEC, FEE, FEA], finished: false },
        { name: "Salto em distância", demonstrativa: true, positions: [KI, FEE, XD], finished: true },
    ]);
    // Natação Feminino
    await events(ED.ENG_2026, "NTF", [FEE, FEA, KI, MEC, XD], [
        { name: "50m livre", positions: [FEA, FEE, FEA, KI, XD, MEC], finished: true },
        { name: "50m costas", positions: [FEE, KI, FEA, MEC], finished: true },
        { name: "Revezamento 4x50m livre", revezamento: true, positions: [FEE, FEA], finished: false },
    ]);

    // Supporters bonus and a penalty.
    await updateTeam(ED.ENG_2026, FEE, { bonusTorcida: true });
    await updateTeam(ED.ENG_2026, FEA, { bonusTorcida: true });
    await updateTeam(ED.ENG_2026, MEC, { penaltyPoints: 3 });

    // Who played for the AAAs, with awards.
    await copaAthletes(ED.ENG_2026, "VM", FEE, ["dev", "arthur", "leonardo", "victor", "marcelo", "joao"], [["MVP da Final", ["dev"]]]);
    await copaAthletes(ED.ENG_2026, "FM", FEE, ["leonardo", "arthur", "victor", "marcelo", "bruno"], [["MVP da Semifinal", ["leonardo"]]]);
    await copaAthletes(ED.ENG_2026, "FF", FEE, ["gabriela", "anaclara", "paula", "renata", "juliana"]);
    await copaAthletes(ED.ENG_2026, "ATM", FEE, ["arthur", "victor"], [["Recorde dos 100m", ["arthur"]]]);
    await copaAthletes(ED.ENG_2026, "FM", FEA, ["diego", "henrique", "gustavo"]);

    // --- Copa Bixo 2026: fully played, then closed ---
    await bracket(ED.BIXO_2026, "FM", [FEA, null, KI, MEC, XD, FEQ, FEE, null], [
        [null, ["2", "3", "b"], ["1", "0", "a"], null],
        [["2", "2 (3)", "a"], ["0", "2", "b"]],
        [["1", "0", "a"]],
    ]);
    await bracket(ED.BIXO_2026, "VF", [FEE, KI, FEA, XD], [
        [["2", "0", "a"], ["2", "1", "a"]],
        [["1", "2", "b"]],
    ]);
    await events(ED.BIXO_2026, "ATF", [FEE, FEA, KI, MEC], [
        { name: "100m rasos", positions: [FEE, FEA, FEE, KI, MEC], finished: true },
        { name: "Revezamento 4x100m", revezamento: true, positions: [FEA, FEE, KI, MEC], finished: true },
    ]);
    await updateTeam(ED.BIXO_2026, FEA, { bonusTorcida: true });
    await copaAthletes(ED.BIXO_2026, "VF", FEE, ["anaclara", "paula", "renata"], [["Destaque do Campeonato", ["paula"]]]);
    await closeEdition(ED.BIXO_2026);

    // --- Editions logged afterwards: results only ---
    await logResults(ED.INTER_2026, [[FEE, 18], [LEU, 15], [FEA, 12], KI, MEC, XD], { FM: [LEU, FEE, KI], XA: [FEA, FEE, MEC] });
    await logResults(ED.ENG_2025, [[FEE, 412], [FEA, 388], [MEC, 350], [XD, 301], [KI, 280], [ECA, 244], [ETA, 198], [FEQ, 170], [FEAGRI, 152]], {
        FM: [FEA, MEC, FEE], VM: [FEE, XD, ECA], VF: [XD, FEE, ECA], BM: [MEC, FEE, KI], ATM: [FEE, FEA, KI],
    });
    await logResults(ED.ENG_2024, [FEA, FEE, XD], { FM: [FEE, FEA, KI], VM: [FEE, MEC, XD] });
    await logResults(ED.ENG_2023, [MEC, FEA, KI], { FM: [MEC, KI, FEA, FEE], VM: [XD, FEE, MEC] });
    await logResults(ED.BIXO_2025, [MEC, KI, FEA], { FM: [KI, MEC, XD], VF: [FEA, FEE, KI] });

    await copaAthletes(ED.ENG_2025, "VM", FEE, ["dev", "thiago", "arthur", "leonardo"], [["Melhor Jogador", ["dev"]]]);
    await copaAthletes(ED.ENG_2023, "FM", FEE, ["dev", "leonardo"]);
    await copaAthletes(ED.INTER_2026, "FM", LEU, ["rafael", "pedro", "lucas", "dev"], [["Artilheiro", ["rafael"]]]);
}
