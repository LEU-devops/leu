import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Nested venues: "FEF" > "Complexo de Vôlei" > "Q1". A root venue has parent_id = null.
    await knex.schema.createTable("venues", (t) => {
        t.increments("id");
        t.string("name").notNullable();
        t.integer("parent_id").references("id").inTable("venues").onDelete("CASCADE");
        t.unique(["parent_id", "name"]);
    });

    // Raw ADD COLUMN on purpose: knex's alterTable would rebuild `matches` (copy, drop, rename),
    // and the DROP fails with foreign_keys ON because matches reference each other via next_match_id.
    // SQLite's native ADD COLUMN accepts a REFERENCES clause when the default is NULL.
    await knex.raw("ALTER TABLE matches ADD COLUMN venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL");
}

export async function down(knex: Knex): Promise<void> {
    // Same reason: native DROP COLUMN (SQLite 3.35+) instead of knex's table rebuild.
    await knex.raw("ALTER TABLE matches DROP COLUMN venue_id");
    await knex.schema.dropTableIfExists("venues");
}
