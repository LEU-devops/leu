import { createAward } from "../../src/modules/awards/controller";
import { addParticipationAward, createExternalParticipation } from "../../src/modules/participations/controller";
import { DEV_EMAIL, email, ORG, type PersonKey, TEAM } from "../seed-utils";

/**
 * Championships outside the LEU Copas (TUSCA, Engenharíadas...) with athletes, results and the
 * individual awards given there, plus awards not tied to a championship. Created through the
 * app's controllers (as dev@test.com, LEU president), so they follow the same rules as the API.
 */

const emails = (people: PersonKey[]) => people.map(email);

interface Championship {
    team: number;
    competition: string;
    year: number;
    /** 1 = ouro, 2 = prata, 3 = bronze, 4+ = position, null = participação. */
    placement: number | null;
    athletes: PersonKey[];
    awards?: [string, PersonKey[]][];
}

const CHAMPIONSHIPS: Championship[] = [
    { team: TEAM.FEE_VOLEI_M, competition: "TUSCA", year: 2026, placement: 1, athletes: ["dev", "arthur", "leonardo", "victor", "marcelo"],
        awards: [["MVP da Final", ["dev"]], ["Melhor Levantador", ["arthur"]]] },
    { team: TEAM.FEE_VOLEI_M, competition: "Engenharíadas", year: 2025, placement: 2, athletes: ["dev", "thiago", "arthur", "leonardo"],
        awards: [["Seleção do Campeonato", ["dev", "thiago"]]] },
    { team: TEAM.FEE_VOLEI_M, competition: "Liga Universitária", year: 2024, placement: null, athletes: ["dev", "thiago"] },
    { team: TEAM.FEE_FUTSAL_F, competition: "InterLEU", year: 2026, placement: 3, athletes: ["gabriela", "anaclara", "paula", "renata"],
        awards: [["Artilheira", ["anaclara"]]] },
    { team: TEAM.FEE_FUTSAL_F, competition: "JUCA", year: 2025, placement: 4, athletes: ["gabriela", "larissa", "juliana"] },
    { team: TEAM.FEA_FUTSAL_M, competition: "Copa Unicamp", year: 2026, placement: 1, athletes: ["diego", "henrique", "gustavo"],
        awards: [["Artilheiro", ["diego"]]] },
    { team: TEAM.LEU_FUTSAL, competition: "Engenharíadas", year: 2026, placement: 2, athletes: ["leonardo", "diego", "caio", "andre", "igor"],
        awards: [["Revelação do Campeonato", ["igor"]]] },
];

export async function seed(): Promise<void> {
    for (const championship of CHAMPIONSHIPS) {
        const participation = await createExternalParticipation(DEV_EMAIL, {
            sports_team_id: championship.team,
            competition: championship.competition,
            year: championship.year,
            placement: championship.placement,
            athletes: emails(championship.athletes),
        });
        for (const [title, recipients] of championship.awards ?? [])
            await addParticipationAward(DEV_EMAIL, participation.id!, { title, recipients: emails(recipients) });
    }

    // Awards outside a championship.
    await createAward(DEV_EMAIL, { organization_id: ORG.LEU, title: "Atleta do Ano", competition: "Prêmio LEU", year: 2025, placement: null, recipients: [DEV_EMAIL] });
    await createAward(DEV_EMAIL, { organization_id: ORG.FEE, sports_team_id: TEAM.FEE_FUTSAL_F, title: "Destaque Feminino", competition: "Melhores do Ano", year: 2025, placement: "ouro", recipients: [email("gabriela")] });
    await createAward(DEV_EMAIL, { organization_id: ORG.KI, title: "Atleta Revelação", competition: "Melhores do Ano", year: 2025, placement: null, recipients: [email("yasmin")] });
}
