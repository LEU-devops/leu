import { config as loadEnv } from "dotenv";
import path from "path";
import type { Knex } from "knex";

loadEnv({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";

// Works both from source (ts-node, __dirname = backend/) and from the build (__dirname = backend/dist/).
const migrations: Knex.MigratorConfig = {
    directory: path.join(__dirname, "data", "migrations"),
    extension: "ts",
};

const seeds: Knex.SeederConfig = {
    directory: path.join(__dirname, "data", "seeds"),
    extension: "ts",
};

function developmentConfig(): Knex.Config {
    return {
        client: "better-sqlite3",
        connection: {
            filename: process.env.SQLITE_FILE ?? "./data/dev.sqlite3",
        },
        useNullAsDefault: true,
        pool: {
            afterCreate(conn: { pragma(sql: string): unknown }, done: (err: Error | null, conn: unknown) => void) {
                conn.pragma("foreign_keys = ON");
                done(null, conn);
            },
        },
        migrations,
        seeds,
    };
}

function productionConfig(): Knex.Config {
    const connectionString = process.env.SUPABASE_POSTGRES_URL;
    if (!connectionString)
        throw new Error("SUPABASE_POSTGRES_URL must be set when NODE_ENV=production");
    return {
        client: "pg",
        connection: { connectionString, ssl: { rejectUnauthorized: false } },
        pool: { min: 0, max: 2, idleTimeoutMillis: 10_000 },
        migrations,
        seeds,
    };
}


const config: Knex.Config = isProduction ? productionConfig() : developmentConfig();

export default config;
