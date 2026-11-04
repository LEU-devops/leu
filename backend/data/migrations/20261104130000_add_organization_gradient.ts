import type { Knex } from "knex";

const DEFAULT_GRADIENT = "linear-gradient(135deg, #1f2937 0%, #111827 100%)";

export async function up(knex: Knex): Promise<void> {
    await knex.raw(
        "ALTER TABLE organizations ADD COLUMN gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #1f2937 0%, #111827 100%)';",
        
    );
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw("ALTER TABLE organizations DROP COLUMN gradient");
}
