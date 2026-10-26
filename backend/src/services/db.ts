import knex from "knex";

import config from "../../knexfile";

export const db = knex(config);

/**
 * In development the schema is migrated automatically on boot.
 * In production run `npm run migrate` against Turso as a deploy step instead.
 */
export async function initDatabase() {
    if (process.env.NODE_ENV === "production")
        return;

    const [, applied] = await db.migrate.latest();
    if (applied.length > 0)
        console.log("Applied migrations:", applied.join(", "));
}
