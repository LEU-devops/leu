import type { Knex } from "knex";
import { email, ORG, type PersonKey, syncSequences } from "../seed-utils";

/**
 * The LEU and the AAAs with their visual identity, and the positions of their people: the 2026
 * management (current) and earlier periods, so the profiles have a history ("Trajetória").
 * Links and handles are placeholders.
 */

interface Identity {
    id: number;
    name: string;
    short_name: string;
    description: string;
    gradient: string;
    accent_color: string | null;
    about: string | null;
    instagram: string | null;
    website: string | null;
    contact_email: string | null;
    store_url: string | null;
}

function identity(id: number, name: string, shortName: string, description: string, gradient: string, accent: string | null, about: string | null, extras: Partial<Identity> = {}): Identity {
    const handle = name.toLowerCase();
    return {
        id,
        name,
        short_name: shortName,
        description,
        gradient,
        accent_color: accent,
        about,
        instagram: `${handle}.exemplo`,
        website: null,
        contact_email: `contato@${handle}.example.com`,
        store_url: null,
        ...extras,
    };
}

const ORGANIZATIONS: Identity[] = [
    identity(ORG.LEU, "LEU", "LEU", "Liga das Engenharias da UNICAMP", "linear-gradient(135deg, #7f1d1d 0%, #111827 100%)", "#ef4444",
        "A LEU reúne as atléticas das engenharias da UNICAMP e organiza a Copa Eng, a Copa Bixo e o InterGestões.\n\nTambém representa as engenharias nos campeonatos universitários.",
        { website: "https://leu.example.com", store_url: "https://loja.leu.example.com" }),
    identity(ORG.KI, "AAAKI", "KI", "Associação Atlética Acadêmica Kamal Ismail", "linear-gradient(135deg, #14532d 0%, #052e16 100%)", "#22c55e",
        "Atlética da Engenharia Civil, Arquitetura e Urbanismo."),
    identity(ORG.ECA, "AAAECA", "ECA", "Associação Atlética Acadêmica da Engenharia de Controle e Automação", "linear-gradient(135deg, #1e3a8a 0%, #172554 100%)", "#3b82f6", null),
    identity(ORG.ETA, "AAAETA", "ETA", "Associação Atlética Acadêmica das Engenharias de Telecomunicações, Transportes e Ambiental", "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)", "#14b8a6", null),
    identity(ORG.FEA, "AAAFEA", "FEA", "Associação Atlética Acadêmica da Faculdade de Engenharia de Alimentos", "linear-gradient(135deg, #854d0e 0%, #422006 100%)", "#eab308",
        "Atlética da Engenharia de Alimentos. Bicampeã da Copa Bixo.", { store_url: "https://loja.aaafea.example.com" }),
    identity(ORG.FEAGRI, "AAAFEAGRI", "FEAGRI", "Associação Atlética Acadêmica da Faculdade de Engenharia Agrícola", "linear-gradient(135deg, #4d7c0f 0%, #1a2e05 100%)", "#84cc16", null),
    identity(ORG.FEE, "AAAFEE", "FEE", "Associação Atlética Acadêmica da Faculdade de Engenharia Elétrica", "linear-gradient(135deg, #9f1239 0%, #4c0519 100%)", "#f43f5e",
        "Atlética da Engenharia Elétrica e de Computação. Até 2024 competia como FEEC.",
        { website: "https://aaafee.example.com", store_url: "https://loja.aaafee.example.com" }),
    identity(ORG.FEQ, "AAAFEQ", "FEQ", "Associação Atlética Acadêmica da Faculdade de Engenharia Química", "linear-gradient(135deg, #9a3412 0%, #431407 100%)", "#f97316", null),
    identity(ORG.MEC, "AAAMEC", "MEC", "Associação Atlética Acadêmica da Engenharia Mecânica", "linear-gradient(135deg, #334155 0%, #0f172a 100%)", null,
        "Atlética da Engenharia Mecânica."),
    identity(ORG.XD, "AAAXD", "XD", "Associação Atlética Acadêmica X de Dezembro", "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", "#a855f7", null),
];

type Role = "presidente" | "vice" | "diretor" | "membro" | "conselheiro" | "aluno";

const CURRENT = "2026-01-01";

function position(organizationId: number, person: PersonKey, role: Role, area: string | null = null, startedOn = CURRENT, endedOn: string | null = null) {
    return { organization_id: organizationId, user_email: email(person), role, director_area: area, started_on: startedOn, ended_on: endedOn };
}

/** Students of an AAA ("aluno" affiliation), current. */
function students(organizationId: number, people: PersonKey[], startedOn = "2025-03-01") {
    return people.map((person) => position(organizationId, person, "aluno", null, startedOn));
}

export async function seed(knex: Knex): Promise<void> {
    await knex("organizations").insert(ORGANIZATIONS);
    await syncSequences(knex, ["organizations"]);

    await knex("organization_positions").insert([
        // --- LEU, 2026 ---
        position(ORG.LEU, "dev", "presidente"),
        position(ORG.LEU, "mariana", "vice"),
        position(ORG.LEU, "rafael", "diretor", "Esportes"),
        position(ORG.LEU, "beatriz", "diretor", "Secretaria"),
        position(ORG.LEU, "lucas", "diretor", "Marketing"),
        position(ORG.LEU, "camila", "diretor", "Financeiro"),
        position(ORG.LEU, "pedro", "membro"),
        position(ORG.LEU, "gabriel", "conselheiro"),
        // --- LEU, earlier ---
        position(ORG.LEU, "mariana", "presidente", null, "2025-01-01", "2025-12-31"),
        position(ORG.LEU, "dev", "diretor", "Esportes", "2025-01-01", "2025-12-31"),
        position(ORG.LEU, "rafael", "membro", null, "2025-03-01", "2025-12-31"),
        position(ORG.LEU, "beatriz", "membro", null, "2024-08-01", "2025-12-31"),
        position(ORG.LEU, "gabriel", "presidente", null, "2024-01-01", "2024-12-31"),
        position(ORG.LEU, "mariana", "diretor", "Eventos", "2024-01-01", "2024-12-31"),

        // --- AAAFEE ---
        position(ORG.FEE, "thiago", "presidente"),
        position(ORG.FEE, "larissa", "vice"),
        position(ORG.FEE, "joao", "diretor", "Esportes"),
        position(ORG.FEE, "fernanda", "diretor", "Marketing"),
        position(ORG.FEE, "bruno", "diretor", "Secretaria"),
        position(ORG.FEE, "juliana", "membro"),
        position(ORG.FEE, "dev", "aluno", null, "2025-01-01"),
        ...students(ORG.FEE, ["arthur", "leonardo", "gabriela", "anaclara", "victor", "marcelo", "paula", "renata"]),
        position(ORG.FEE, "larissa", "presidente", null, "2025-01-01", "2025-12-31"),
        position(ORG.FEE, "thiago", "diretor", "Esportes", "2025-01-01", "2025-12-31"),
        position(ORG.FEE, "joao", "membro", null, "2025-03-01", "2025-12-31"),
        position(ORG.FEE, "dev", "membro", null, "2023-03-01", "2024-12-31"),

        // --- AAAFEA ---
        position(ORG.FEA, "isabela", "presidente"),
        position(ORG.FEA, "gustavo", "diretor", "Esportes"),
        position(ORG.FEA, "carolina", "diretor", "Marketing"),
        ...students(ORG.FEA, ["diego", "bianca", "henrique"]),
        position(ORG.FEA, "isabela", "vice", null, "2025-01-01", "2025-12-31"),

        // --- AAAKI ---
        position(ORG.KI, "matheus", "presidente"),
        position(ORG.KI, "amanda", "diretor", "Esportes"),
        ...students(ORG.KI, ["caio", "yasmin"]),

        // --- AAAMEC ---
        position(ORG.MEC, "felipe", "presidente"),
        position(ORG.MEC, "natalia", "diretor", "Esportes"),
        ...students(ORG.MEC, ["andre", "livia"]),

        // --- AAAXD ---
        position(ORG.XD, "vinicius", "presidente"),
        position(ORG.XD, "leticia", "diretor", "Marketing"),
        ...students(ORG.XD, ["igor"]),

        // --- Other AAAs ---
        position(ORG.ECA, "rodrigo", "presidente"),
        position(ORG.ETA, "daniela", "presidente"),
        position(ORG.FEAGRI, "eduardo", "presidente"),
        position(ORG.FEQ, "sofia", "presidente"),
    ]);
}
