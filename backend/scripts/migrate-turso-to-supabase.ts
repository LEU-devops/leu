/**
 * One-off copy of the production data from Turso (libsql) into Supabase (Postgres).
 *
 * Prerequisites:
 *   - The Knex migrations have already been run against Supabase (`NODE_ENV=production npm run migrate`).
 *   - LIBSQL_URL / LIBSQL_AUTH_TOKEN point at the Turso database (source).
 *   - SUPABASE_POSTGRES_URL points at Supabase (destination). Use the non-pooling URL if available.
 *
 * Usage:
 *   npm run migrate:from-turso            # copies everything inside one transaction
 *   npm run migrate:from-turso -- --dry-run   # only prints the row counts, writes nothing
 *
 * The destination tables must be empty; the script aborts otherwise so nothing is duplicated.
 */
import { createClient, type Row } from "@libsql/client";
import knex, { type Knex } from "knex";

import config from "../knexfile";

// Insert order matters: every table must come after the tables it references.
// Self references (venues.parent_id, matches.next_match_id) are fine because each table is
// inserted with a single statement and Postgres checks foreign keys at the end of the statement.
const TABLES: { name: string; hasSerialId: boolean }[] = [
    { name: "users", hasSerialId: false },
    { name: "permissions", hasSerialId: false },
    { name: "modalities", hasSerialId: false },
    { name: "teams", hasSerialId: true },
    { name: "venues", hasSerialId: true },
    { name: "time_slots", hasSerialId: true },
    { name: "matches", hasSerialId: true },
];

// Postgres allows at most 65535 bind parameters per statement. Well above what this app holds,
// but fail loudly instead of with an obscure driver error if that ever changes.
const MAX_PARAMS_PER_STATEMENT = 65_000;

const dryRun = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name} must be set`);
    return value;
}

function toObject(columns: string[], row: Row): Record<string, unknown> {
    // libsql rows are array-like with the column names as extra keys; rebuild a plain object.
    return Object.fromEntries(columns.map((column, i) => [column, row[i]]));
}

async function readTable(turso: ReturnType<typeof createClient>, table: string) {
    const result = await turso.execute(`SELECT * FROM ${table}`);
    return result.rows.map((row) => toObject(result.columns, row));
}

async function assertDestinationEmpty(trx: Knex.Transaction) {
    const nonEmpty: string[] = [];
    for (const { name } of TABLES) {
        const [{ count }] = await trx(name).count<{ count: string | number }[]>({ count: "*" });
        if (Number(count) > 0)
            nonEmpty.push(`${name} (${count})`);
    }
    if (nonEmpty.length > 0)
        throw new Error(`Destination is not empty, refusing to copy. Non-empty tables: ${nonEmpty.join(", ")}`);
}

async function resetSerial(trx: Knex.Transaction, table: string) {
    // Rows were inserted with explicit ids, so the sequence never advanced.
    // Postgres: setval(seq, max_id) makes the next nextval() return max_id + 1.
    await trx.raw(
        "SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ??",
        [table, table],
    );
}

async function main() {
    if (config.client !== "pg")
        throw new Error("Destination is not Postgres. Run with NODE_ENV=production so knexfile.ts picks Supabase.");

    const turso = createClient({
        url: requireEnv("LIBSQL_URL"),
        authToken: process.env.LIBSQL_AUTH_TOKEN,
    });
    const pg = knex(config);

    try {
        const source = new Map<string, Record<string, unknown>[]>();
        for (const { name } of TABLES) {
            const rows = await readTable(turso, name);
            source.set(name, rows);
            console.log(`turso ${name}: ${rows.length} rows`);
        }

        if (dryRun) {
            console.log("Dry run, nothing written.");
            return;
        }

        await pg.transaction(async (trx) => {
            await assertDestinationEmpty(trx);

            for (const { name, hasSerialId } of TABLES) {
                const rows = source.get(name) ?? [];
                if (rows.length > 0) {
                    const params = rows.length * Object.keys(rows[0]).length;
                    if (params > MAX_PARAMS_PER_STATEMENT)
                        throw new Error(`${name} has too many rows for a single insert (${params} parameters)`);
                    await trx(name).insert(rows);
                }
                if (hasSerialId)
                    await resetSerial(trx, name);

                const [{ count }] = await trx(name).count<{ count: string | number }[]>({ count: "*" });
                if (Number(count) !== rows.length)
                    throw new Error(`${name}: inserted ${rows.length} rows but destination has ${count}`);
                console.log(`supabase ${name}: ${count} rows`);
            }
        });

        console.log("Done.");
    } finally {
        turso.close();
        await pg.destroy();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
