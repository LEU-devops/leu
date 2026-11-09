import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
    // Delete children first to satisfy FK constraints.
    await knex("event_results").del();
    await knex("registrations").del();
    await knex("events").del();
    await knex("matches").del();

    await knex("time_slots").del();
    await knex("venues").del();
    await knex("teams").del();
    await knex("modalities").del();
    await knex("edition_team_scoring").del();
    await knex("copa_editions").del();

    // The current edition gets the brackets; the past one only exists to try the edition selector.
    await knex("copa_editions").insert([
        { id: 1, name: "Copa Eng", year: 2026, is_current: true },
        { id: 2, name: "Copa Bixo", year: 2026, is_current: false },
    ]);
    if (knex.client.config.client === "pg")
        await knex.raw("SELECT setval(pg_get_serial_sequence('copa_editions', 'id'), (SELECT MAX(id) FROM copa_editions))");

    await knex("modalities").insert([
        { code: "BM", short_code: "BM", edition_id: 1, name: "Basquete Masculino", type: "chaveamento" },
        { code: "BF", short_code: "BF", edition_id: 1, name: "Basquete Feminino", type: "chaveamento" },
        { code: "FM", short_code: "FM", edition_id: 1, name: "Futsal Masculino", type: "chaveamento" },
        { code: "FF", short_code: "FF", edition_id: 1, name: "Futsal Feminino", type: "chaveamento" },
        { code: "VM", short_code: "VM", edition_id: 1, name: "Vôlei Masculino", type: "chaveamento" },
        { code: "VF", short_code: "VF", edition_id: 1, name: "Vôlei Feminino", type: "chaveamento" },
        { code: "HM", short_code: "HM", edition_id: 1, name: "Handebol Masculino", type: "chaveamento" },
        { code: "HF", short_code: "HF", edition_id: 1, name: "Handebol Feminino", type: "chaveamento" },
        { code: "TMM", short_code: "TMM", edition_id: 1, name: "Tênis de Mesa Masculino", type: "chaveamento" },
        { code: "TMF", short_code: "TMF", edition_id: 1, name: "Tênis de Mesa Feminino", type: "chaveamento" },
        { code: "TM", short_code: "TM", edition_id: 1, name: "Tênis Campo Masculino", type: "chaveamento" },
        { code: "TF", short_code: "TF", edition_id: 1, name: "Tênis Campo Feminino", type: "chaveamento" },
        { code: "XA", short_code: "XA", edition_id: 1, name: "Xadrez Absoluto", type: "chaveamento" },
        { code: "ATM", short_code: "ATM", edition_id: 1, name: "Atletismo Masculino", type: "atletismo" },
        { code: "ATF", short_code: "ATF", edition_id: 1, name: "Atletismo Feminino", type: "atletismo" },
        { code: "NTA", short_code: "NTA", edition_id: 1, name: "Natação Absoluto", type: "natacao" },
        { code: "NTF", short_code: "NTF", edition_id: 1, name: "Natação Feminino", type: "natacao" },
        { code: "NTM", short_code: "NTM", edition_id: 1, name: "Natação Masculino", type: "natacao" },
    ]);

    await knex("modalities").insert([
        { code: "FM2", short_code: "FM", edition_id: 2, name: "Futsal Masculino", type: "chaveamento" },
        { code: "VF2", short_code: "VF", edition_id: 2, name: "Vôlei Feminino", type: "chaveamento" },
    ]);

    await knex("teams").insert([
        { name: "FEA" },
        { name: "XD" },
        { name: "FEEC" },
        { name: "FEAGRI" },
        { name: "FEQ" },
        { name: "ECA" },
        { name: "MEC" },
        { name: "ETA" },
        { name: "AKI" },
    ]);

    await knex("time_slots").insert(([
        { starts_at: "2026-10-31T11:00:00.000Z" },
        { starts_at: "2026-10-31T12:30:00.000Z" },
        { starts_at: "2026-10-31T14:00:00.000Z" },
        { starts_at: "2026-10-31T16:30:00.000Z" },
        { starts_at: "2026-10-31T18:00:00.000Z" },
        { starts_at: "2026-10-31T19:30:00.000Z" },
        { starts_at: "2026-10-31T21:00:00.000Z" },
        { starts_at: "2026-10-31T22:30:00.000Z" },
        { starts_at: "2026-11-01T11:00:00.000Z" },
        { starts_at: "2026-11-01T12:30:00.000Z" },
        { starts_at: "2026-11-01T14:00:00.000Z" },
        { starts_at: "2026-11-01T16:30:00.000Z" },
        { starts_at: "2026-11-01T18:00:00.000Z" },
        { starts_at: "2026-11-01T19:30:00.000Z" },
        { starts_at: "2026-11-01T21:00:00.000Z" },
        { starts_at: "2026-11-01T22:30:00.000Z" },
        { starts_at: "2026-11-02T11:00:00.000Z" },
        { starts_at: "2026-11-02T12:30:00.000Z" },
        { starts_at: "2026-11-02T14:00:00.000Z" },
        { starts_at: "2026-11-02T16:30:00.000Z" },
        { starts_at: "2026-11-02T18:00:00.000Z" },
        { starts_at: "2026-11-02T19:30:00.000Z" },
        { starts_at: "2026-11-02T21:00:00.000Z" },
        { starts_at: "2026-11-02T22:30:00.000Z" },
    ] as { starts_at: string }[]).map((slot) => ({ ...slot, edition_id: 1 })));

    await knex("venues").insert([
        { id: 1, name: "FEF", parent_id: null },
        { id: 2, name: "Civil", parent_id: null },
        { id: 3, name: "Volei", parent_id: 1 },
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
    ]);

    await knex("events").insert([
        { modality_code: "ATM", name: "100m rasos", revezamento: false, demonstrativa: false, sort_order: 0 },
        { modality_code: "ATM", name: "400m", revezamento: false, demonstrativa: false, sort_order: 1 },
        { modality_code: "ATM", name: "1500m", revezamento: false, demonstrativa: false, sort_order: 2 },

        { modality_code: "ATF", name: "100m rasos", revezamento: false, demonstrativa: false, sort_order: 0 },
        { modality_code: "ATF", name: "400m", revezamento: false, demonstrativa: false, sort_order: 1 },
        { modality_code: "ATF", name: "1500m", revezamento: false, demonstrativa: false, sort_order: 2 },

        { modality_code: "NTM", name: "50m borboleta", revezamento: false, demonstrativa: false, sort_order: 0 },
        { modality_code: "NTM", name: "50m costas", revezamento: false, demonstrativa: false, sort_order: 1 },
        { modality_code: "NTM", name: "50m peito", revezamento: false, demonstrativa: false, sort_order: 2 },
        { modality_code: "NTM", name: "50m livre", revezamento: false, demonstrativa: false, sort_order: 3 },
        { modality_code: "NTM", name: "Revezamento 4x50m livre", revezamento: true, demonstrativa: false, sort_order: 4 },
        { modality_code: "NTM", name: "100m medley", revezamento: false, demonstrativa: false, sort_order: 5 },
        { modality_code: "NTM", name: "Revezamento 4x50m medley", revezamento: true, demonstrativa: true, sort_order: 6 },

        { modality_code: "NTF", name: "50m borboleta", revezamento: false, demonstrativa: false, sort_order: 0 },
        { modality_code: "NTF", name: "50m costas", revezamento: false, demonstrativa: false, sort_order: 1 },
        { modality_code: "NTF", name: "50m peito", revezamento: false, demonstrativa: false, sort_order: 2 },
        { modality_code: "NTF", name: "50m livre", revezamento: false, demonstrativa: false, sort_order: 3 },
        { modality_code: "NTF", name: "Revezamento 4x50m livre", revezamento: true, demonstrativa: false, sort_order: 4 },
        { modality_code: "NTF", name: "100m medley", revezamento: false, demonstrativa: false, sort_order: 5 },
        { modality_code: "NTF", name: "Revezamento 4x50m medley", revezamento: true, demonstrativa: true, sort_order: 6 },

    ]);
}