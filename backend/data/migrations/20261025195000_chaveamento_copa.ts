import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("modalities", (t) => {
        t.string("code", 2).primary();        // 2 letras, ex.: "FM" (futebol masculino)
        t.string("name").notNullable();
        t.string("type").notNullable();       // "chaveamento" | "fase_unica"
    });

    // Times são globais: o mesmo time (ex.: uma atlética) participa de várias modalidades.
    await knex.schema.createTable("teams", (t) => {
        t.increments("id");
        t.string("name").notNullable().unique();
    });

    await knex.schema.createTable("matches", (t) => {
        t.increments("id");
        t.string("modality_code", 2).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        t.string("stage").notNullable();      // "r16", "qf", "sf", "final"
        t.integer("round").notNullable();     // 1 = primeira rodada da chave ... N = final
        t.integer("position").notNullable();  // índice dentro da rodada, de cima para baixo
        t.integer("team_a_id").references("id").inTable("teams"); // nulo até o time ser definido
        t.integer("team_b_id").references("id").inTable("teams");
        t.integer("score_a");
        t.integer("score_b");
        t.integer("winner_id").references("id").inTable("teams");
        t.integer("next_match_id").references("id").inTable("matches");
        t.string("next_slot");                // "a" ou "b": em qual lado da próxima partida o vencedor entra
        t.string("status").notNullable().defaultTo("scheduled"); // scheduled, live, finished, walkover
        t.datetime("scheduled_at");
        t.unique(["modality_code", "round", "position"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("matches");
    await knex.schema.dropTableIfExists("teams");
    await knex.schema.dropTableIfExists("modalities");
}
