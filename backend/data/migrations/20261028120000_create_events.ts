import type { Knex } from "knex";

/**
 * Events modalities (atletismo, natação): instead of a bracket, the modality is decided by a set
 * of internal events ("provas"), e.g. "100m rasos" and "200m rasos".
 *
 *  - registrations: which teams take part in the modality. Registration is per modality, not per
 *    event, and the number of registered teams picks the PONTUACAO.md table used by every event.
 *  - events: the internal events, with a `kind` that says how they score (normal, demonstrativa
 *    = no points, revezamento = double points) and a `finished` flag closed by the organizers.
 *  - event_results: the team that finished each event in each position.
 *
 * Only new tables, so the schema builder is fine here (no rebuild of `matches`).
 */
export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("registrations", (t) => {
        t.string("modality_code", 3).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        t.integer("team_id").notNullable().references("id").inTable("teams").onDelete("CASCADE");
        t.primary(["modality_code", "team_id"]);
    });

    await knex.schema.createTable("events", (t) => {
        t.increments("id");
        t.string("modality_code", 3).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        t.string("name").notNullable();
        t.string("kind").notNullable().defaultTo("normal"); // normal | demonstrativa | revezamento
        t.boolean("finished").notNullable().defaultTo(false);
        t.integer("sort_order").notNullable().defaultTo(0);
        t.unique(["modality_code", "name"]);
    });

    await knex.schema.createTable("event_results", (t) => {
        t.integer("event_id").notNullable().references("id").inTable("events").onDelete("CASCADE");
        t.integer("team_id").notNullable().references("id").inTable("teams").onDelete("CASCADE");
        t.integer("position").notNullable(); // 1 = first place
        t.primary(["event_id", "team_id"]);
        t.unique(["event_id", "position"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("event_results");
    await knex.schema.dropTableIfExists("events");
    await knex.schema.dropTableIfExists("registrations");
}
