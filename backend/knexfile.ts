import { config as loadEnv } from "dotenv";
import path from "path";
import type { Knex } from "knex";
import Client_Libsql from "@libsql/knex-libsql";

loadEnv({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";

// Works both from source (ts-node, __dirname = backend/) and from the build (__dirname = backend/dist/).
const migrations: Knex.MigratorConfig = {
    directory: path.join(__dirname, "data", "migrations"),
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
    };
}

function productionConfig(): Knex.Config {
    const url = process.env.LIBSQL_URL;
    const authToken = process.env.LIBSQL_AUTH_TOKEN;
    if (!url)
        throw new Error("LIBSQL_URL must be set when NODE_ENV=production");

    // The libsql dialect takes the auth token as a query parameter on the URL.
    const separator = url.includes("?") ? "&" : "?";
    const filename = authToken ? `${url}${separator}authToken=${encodeURIComponent(authToken)}` : url;

    return {
        client: Client_Libsql,
        connection: { filename },
        useNullAsDefault: true,
        migrations,
    };
}

const config: Knex.Config = isProduction ? productionConfig() : developmentConfig();

export default config;
