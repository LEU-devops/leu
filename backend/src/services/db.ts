import { createClient } from "@libsql/client";

import { config } from "dotenv";

config({ quiet: true });

const dbUrl = process.env.LIBSQL_URL;
if (!dbUrl) {
    console.error("LIBSQL_URL is not set in the environment variables.");
    process.exit(1);
}
console.log("Connecting to database at", dbUrl);

export const db = createClient({
    url: dbUrl,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
});

export async function initDatabase() {
    await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            admin BOOLEAN DEFAULT FALSE NOT NULL
        );

        PRAGMA foreign_keys = ON;
    `);

}
