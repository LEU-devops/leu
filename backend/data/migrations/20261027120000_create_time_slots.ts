import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Base schedule: the reference start times of the event ("sáb. 31/10 13:30").
    // They feed the match scheduler's day/time lists and the guide lines of the schedule table.
    await knex.schema.createTable("time_slots", (t) => {
        t.increments("id");
        t.datetime("starts_at").notNullable().unique(); // ISO 8601, UTC
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("time_slots");
}
