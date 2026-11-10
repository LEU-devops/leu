import type { Knex } from "knex";
import { email, ORG, type PersonKey, syncSequences, TEAM } from "../seed-utils";

/**
 * Sports teams of the entities with their rosters: current athletes and DMs plus earlier periods,
 * so the profiles show "ex-" badges and the team pages a roster history.
 */

const TEAMS = [
    { id: TEAM.FEE_VOLEI_M, organization_id: ORG.FEE, name: "Vôlei Masculino" },
    { id: TEAM.FEE_FUTSAL_F, organization_id: ORG.FEE, name: "Futsal Feminino" },
    { id: TEAM.FEE_FUTSAL_M, organization_id: ORG.FEE, name: "Futsal Masculino" },
    { id: TEAM.FEA_FUTSAL_M, organization_id: ORG.FEA, name: "Futsal Masculino" },
    { id: TEAM.FEA_VOLEI_F, organization_id: ORG.FEA, name: "Vôlei Feminino" },
    { id: TEAM.KI_VOLEI_F, organization_id: ORG.KI, name: "Vôlei Feminino" },
    { id: TEAM.MEC_HANDEBOL_M, organization_id: ORG.MEC, name: "Handebol Masculino" },
    { id: TEAM.LEU_FUTSAL, organization_id: ORG.LEU, name: "Seleção LEU de Futsal" },
];

function stint(teamId: number, person: PersonKey, role: "atleta" | "dm", startedOn = "2026-01-01", endedOn: string | null = null) {
    return { team_id: teamId, user_email: email(person), role, started_on: startedOn, ended_on: endedOn };
}

function athletes(teamId: number, people: PersonKey[], startedOn = "2025-03-01") {
    return people.map((person) => stint(teamId, person, "atleta", startedOn));
}

export async function seed(knex: Knex): Promise<void> {
    await knex("sports_teams").insert(TEAMS);
    await syncSequences(knex, ["sports_teams"]);

    await knex("sports_team_stints").insert([
        // AAAFEE Vôlei Masculino: dev plays since 2022 and is the DM in 2026; Thiago was DM in 2025.
        stint(TEAM.FEE_VOLEI_M, "dev", "atleta", "2022-03-01"),
        stint(TEAM.FEE_VOLEI_M, "dev", "dm"),
        stint(TEAM.FEE_VOLEI_M, "thiago", "dm", "2025-01-01", "2025-12-31"),
        stint(TEAM.FEE_VOLEI_M, "thiago", "atleta", "2023-03-01", "2025-12-31"),
        ...athletes(TEAM.FEE_VOLEI_M, ["arthur", "leonardo", "victor", "marcelo", "joao"]),

        // AAAFEE Futsal Feminino
        stint(TEAM.FEE_FUTSAL_F, "gabriela", "dm"),
        stint(TEAM.FEE_FUTSAL_F, "larissa", "dm", "2024-01-01", "2025-12-31"),
        ...athletes(TEAM.FEE_FUTSAL_F, ["gabriela", "anaclara", "paula", "renata", "juliana"]),
        stint(TEAM.FEE_FUTSAL_F, "larissa", "atleta", "2023-03-01"),

        // AAAFEE Futsal Masculino
        stint(TEAM.FEE_FUTSAL_M, "leonardo", "dm", "2025-01-01"),
        ...athletes(TEAM.FEE_FUTSAL_M, ["leonardo", "arthur", "victor", "marcelo", "bruno"]),
        stint(TEAM.FEE_FUTSAL_M, "dev", "atleta", "2022-03-01", "2023-12-31"),

        // AAAFEA
        stint(TEAM.FEA_FUTSAL_M, "diego", "dm"),
        ...athletes(TEAM.FEA_FUTSAL_M, ["diego", "henrique", "gustavo"]),
        stint(TEAM.FEA_VOLEI_F, "bianca", "dm"),
        ...athletes(TEAM.FEA_VOLEI_F, ["bianca", "carolina", "isabela"]),

        // AAAKI, AAAMEC
        stint(TEAM.KI_VOLEI_F, "yasmin", "dm"),
        ...athletes(TEAM.KI_VOLEI_F, ["yasmin", "amanda"]),
        stint(TEAM.MEC_HANDEBOL_M, "andre", "dm"),
        ...athletes(TEAM.MEC_HANDEBOL_M, ["andre", "felipe"]),

        // LEU: a team of players from several AAAs for the university championships.
        stint(TEAM.LEU_FUTSAL, "rafael", "dm"),
        ...athletes(TEAM.LEU_FUTSAL, ["leonardo", "diego", "caio", "andre", "igor"], "2026-02-01"),
    ]);
}
