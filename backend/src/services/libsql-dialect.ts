import type { Knex } from "knex";

// The sqlite3 dialect is not part of knex's public typings, hence the require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Client_SQLite3: typeof Knex.Client = require("knex/lib/dialects/sqlite3");

/**
 * Knex dialect for Turso/libsql over HTTP. Same SQL as the sqlite3 dialect, but the
 * driver is `@libsql/sqlite3`, which is pure JavaScript: nothing native to compile on deploy.
 * Inlined from `@libsql/knex-libsql`, whose package also dragged in the native `sqlite3`
 * module and an outdated node-gyp that cannot build on Python 3.12 (Vercel).
 */
class Client_Libsql extends Client_SQLite3 {
    _driver() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("@libsql/sqlite3");
    }
}

Object.assign(Client_Libsql.prototype, {
    dialect: "libsql",
    driverName: "libsql",
});

export default Client_Libsql;
