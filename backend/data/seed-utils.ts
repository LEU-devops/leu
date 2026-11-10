import type { Knex } from "knex";

/**
 * Helpers shared by the seeds (kept out of data/seeds, where every file must be a seed).
 */

/** Password of every seeded user, `dev@test.com` included. */
export const SEED_PASSWORD = "123456";

export const DEV_EMAIL = "dev@test.com";

/** Organization ids used across the seeds. */
export const ORG = { LEU: 1, KI: 2, ECA: 3, ETA: 4, FEA: 5, FEAGRI: 6, FEE: 7, FEQ: 8, MEC: 9, XD: 10 } as const;

/** Sports team ids (03_sports). */
export const TEAM = {
    FEE_VOLEI_M: 1,
    FEE_FUTSAL_F: 2,
    FEE_FUTSAL_M: 3,
    FEA_FUTSAL_M: 4,
    FEA_VOLEI_F: 5,
    KI_VOLEI_F: 6,
    MEC_HANDEBOL_M: 7,
    LEU_FUTSAL: 8,
} as const;

/** Every AAA (all organizations but the LEU). */
export const AAAS = [ORG.KI, ORG.ECA, ORG.ETA, ORG.FEA, ORG.FEAGRI, ORG.FEE, ORG.FEQ, ORG.MEC, ORG.XD];

/** Postgres: explicit ids do not advance the sequences, so later inserts would collide. */
export async function syncSequences(knex: Knex, tables: string[]): Promise<void> {
    if (knex.client.config.client !== "pg") return;
    for (const table of tables)
        await knex.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
}

/** Seeded people by key: [nickname, full name]. E-mails are `<key>@example.com`, except the dev account. */
const PEOPLE_LIST = {
    dev: ["Dev", "Dev Tester"],
    // LEU board
    mariana: ["Mari", "Mariana Costa"],
    rafael: ["Rafa", "Rafael Lima"],
    beatriz: ["Bia", "Beatriz Alves"],
    lucas: ["Luquinhas", "Lucas Pereira"],
    camila: ["Cami", "Camila Rocha"],
    pedro: ["PH", "Pedro Henrique Moura"],
    gabriel: ["Gabs", "Gabriel Santos"],
    // AAAFEE
    thiago: ["Thi", "Thiago Martins"],
    larissa: ["Lari", "Larissa Gomes"],
    joao: ["JV", "João Victor Azevedo"],
    fernanda: ["Fefe", "Fernanda Dias"],
    bruno: ["Bruninho", "Bruno Carvalho"],
    juliana: ["Ju", "Juliana Ribeiro"],
    arthur: ["Arthur", "Arthur Silva"],
    leonardo: ["Leo", "Leonardo Souza"],
    gabriela: ["Gabi", "Gabriela Melo"],
    anaclara: ["Aninha", "Ana Clara Nogueira"],
    victor: ["VH", "Victor Hugo Lacerda"],
    marcelo: ["Marcelão", "Marcelo Duarte"],
    paula: ["Paulinha", "Paula Vieira"],
    renata: ["Rê", "Renata Fogaça"],
    // AAAFEA
    isabela: ["Isa", "Isabela Moreira"],
    gustavo: ["Guga", "Gustavo Nunes"],
    carolina: ["Carol", "Carolina Freitas"],
    diego: ["Diegão", "Diego Farias"],
    bianca: ["Bia L.", "Bianca Lima"],
    henrique: ["Rick", "Henrique Torres"],
    // AAAKI
    matheus: ["Teteu", "Matheus Barbosa"],
    amanda: ["Mandinha", "Amanda Teixeira"],
    caio: ["Caio", "Caio Batista"],
    yasmin: ["Yas", "Yasmin Prado"],
    // AAAMEC
    felipe: ["Lipe", "Felipe Araújo"],
    natalia: ["Nati", "Natália Cardoso"],
    andre: ["Dedé", "André Monteiro"],
    livia: ["Lívia", "Lívia Moura"],
    // AAAXD
    vinicius: ["Vini", "Vinícius Mendes"],
    leticia: ["Lelê", "Letícia Castro"],
    igor: ["Igor", "Igor Campos"],
    // Other AAAs
    rodrigo: ["Digão", "Rodrigo Pinto"],
    daniela: ["Dani", "Daniela Lopes"],
    eduardo: ["Dudu", "Eduardo Ramos"],
    sofia: ["Sofi", "Sofia Cunha"],
} as const satisfies Record<string, readonly [string, string]>;

export type PersonKey = keyof typeof PEOPLE_LIST;

export const PEOPLE = Object.entries(PEOPLE_LIST).map(([key, [nickname, fullName]]) => ({
    key: key as PersonKey,
    email: key === "dev" ? DEV_EMAIL : `${key}@example.com`,
    nickname,
    full_name: fullName,
}));

/** E-mail of a seeded person. */
export function email(key: PersonKey): string {
    return PEOPLE.find((person) => person.key === key)!.email;
}
