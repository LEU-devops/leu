import type { Knex } from "knex";

const COLUMNS = [
    "logo_url",
    "banner_url",
    "accent_color",
    "about",
    "instagram",
    "website",
    "contact_email",
    "store_url",
];

export async function up(knex: Knex): Promise<void> {
    for (const column of COLUMNS)
        await knex.raw(`ALTER TABLE organizations ADD COLUMN ${column} TEXT`);
}

export async function down(knex: Knex): Promise<void> {
    for (const column of [...COLUMNS].reverse())
        await knex.raw(`ALTER TABLE organizations DROP COLUMN ${column}`);
}
