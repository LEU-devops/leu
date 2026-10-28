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

    await knex("modalities").insert([
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

    await knex("time_slots").insert([
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
    ]);

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
        { modality_code: "ATM", name: "100m rasos", sort_order: 0 },
        { modality_code: "ATM", name: "400m", sort_order: 1 },
        { modality_code: "ATM", name: "1500m", sort_order: 2 },

        { modality_code: "ATF", name: "100m rasos", sort_order: 0 },
        { modality_code: "ATF", name: "400m", sort_order: 1 },
        { modality_code: "ATF", name: "1500m", sort_order: 2 },

        { modality_code: "NTM", name: "50m borboleta", sort_order: 0 },
        { modality_code: "NTM", name: "50m costas", sort_order: 1 },
        { modality_code: "NTM", name: "50m peito", sort_order: 2 },
        { modality_code: "NTM", name: "50m livre", sort_order: 3 },
        { modality_code: "NTM", name: "Revezamento 4x50m livre", revezamento: true, sort_order: 4 },
        { modality_code: "NTM", name: "100m medley", sort_order: 5 },
        { modality_code: "NTM", name: "Revezamento 4x50m medley", revezamento: true, demonstrativo: true, sort_order: 6 },

        { modality_code: "NTF", name: "50m borboleta", sort_order: 0 },
        { modality_code: "NTF", name: "50m costas", sort_order: 1 },
        { modality_code: "NTF", name: "50m peito", sort_order: 2 },
        { modality_code: "NTF", name: "50m livre", sort_order: 3 },
        { modality_code: "NTF", name: "Revezamento 4x50m livre", revezamento: true, sort_order: 4 },
        { modality_code: "NTF", name: "100m medley", sort_order: 5 },
        { modality_code: "NTF", name: "Revezamento 4x50m medley", revezamento: true, demonstrativo: true, sort_order: 6 },

    ]);
}