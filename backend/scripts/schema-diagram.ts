/**
 * Generates docs/schema.md: a Mermaid ER diagram of the database, built from the migrations.
 *
 * The migrations are not parsed: they mix the schema builder, raw SQL and Postgres-only steps, so
 * the only reliable way to know the final schema is to run them. This script runs every migration
 * on a throwaway in-memory SQLite database (the dev database is never touched), then reads the
 * resulting tables, columns, keys and foreign keys and writes the diagram.
 *
 *   npm run schema:diagram           writes docs/schema.md
 *   npm run schema:diagram -- --check   fails if docs/schema.md is out of date (for CI)
 *
 * Column types are the ones SQLite records, so they may differ slightly from Postgres; tables,
 * columns and relations are the same.
 */
import fs from "node:fs";
import path from "node:path";
import knex, { type Knex } from "knex";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "data", "migrations");
const OUTPUT = path.resolve(__dirname, "..", "..", "docs", "schema.md");

/** Knex bookkeeping, not part of the app's model. */
const IGNORED_TABLES = new Set(["knex_migrations", "knex_migrations_lock"]);

interface Column {
    name: string;
    type: string;
    notNull: boolean;
    primaryKey: boolean;
    unique: boolean;
    references: string | null;
}

interface ForeignKey {
    from: string;
    table: string;
    to: string;
}

interface Table {
    name: string;
    columns: Column[];
    foreignKeys: ForeignKey[];
}

function migrationDb(): Knex {
    return knex({
        client: "better-sqlite3",
        connection: { filename: ":memory:" },
        useNullAsDefault: true,
        // One connection only: each new connection to ":memory:" would be a different, empty database.
        pool: {
            min: 1,
            max: 1,
            afterCreate(conn: { pragma(sql: string): unknown }, done: (err: Error | null, conn: unknown) => void) {
                conn.pragma("foreign_keys = ON");
                done(null, conn);
            },
        },
        migrations: { directory: MIGRATIONS_DIR, extension: "ts", loadExtensions: [".ts"] },
    });
}

/** Columns covered by a single-column unique index (composite uniques are not marked per column). */
async function uniqueColumns(db: Knex, table: string): Promise<Set<string>> {
    const unique = new Set<string>();
    const indexes: { name: string; unique: number; partial: number }[] = await db.raw(`PRAGMA index_list("${table}")`);
    for (const index of indexes) {
        if (!index.unique || index.partial) continue;
        const columns: { name: string }[] = await db.raw(`PRAGMA index_info("${index.name}")`);
        if (columns.length === 1) unique.add(columns[0].name);
    }
    return unique;
}

async function readSchema(db: Knex): Promise<Table[]> {
    const rows: { name: string }[] = await db.raw(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tables: Table[] = [];
    for (const { name } of rows.filter((row) => !IGNORED_TABLES.has(row.name))) {
        const info: { name: string; type: string; notnull: number; pk: number }[] = await db.raw(`PRAGMA table_info("${name}")`);
        const foreignKeys: ForeignKey[] = (await db.raw(`PRAGMA foreign_key_list("${name}")`) as { from: string; table: string; to: string }[])
            .map(({ from, table, to }) => ({ from, table, to }));
        const unique = await uniqueColumns(db, name);
        tables.push({
            name,
            foreignKeys,
            columns: info.map((column) => ({
                name: column.name,
                type: column.type,
                notNull: column.notnull === 1 || column.pk > 0,
                primaryKey: column.pk > 0,
                unique: unique.has(column.name),
                references: foreignKeys.find((fk) => fk.from === column.name)?.table ?? null,
            })),
        });
    }
    return tables;
}

/** Mermaid attribute types must be a single word: "varchar(255)" → "varchar". */
function mermaidType(type: string): string {
    return (type.toLowerCase().match(/^[a-z_]+/)?.[0]) || "any";
}

function attribute(column: Column): string {
    const keys = [column.primaryKey ? "PK" : null, column.references ? "FK" : null, column.unique && !column.primaryKey ? "UK" : null]
        .filter(Boolean)
        .join(", ");
    const notes = [column.notNull || column.primaryKey ? null : "nullable", column.references ? `→ ${column.references}` : null]
        .filter(Boolean)
        .join(", ");
    return `        ${mermaidType(column.type)} ${column.name}${keys ? ` ${keys}` : ""}${notes ? ` "${notes}"` : ""}`;
}

/**
 * One line per foreign key, child to parent. The parent side is "exactly one" when the column is
 * NOT NULL and "zero or one" otherwise; the child side is always "zero or many".
 */
function relationship(table: Table, fk: ForeignKey): string {
    const column = table.columns.find((c) => c.name === fk.from)!;
    const parent = column.notNull ? "||" : "|o";
    return `    ${fk.table} ${parent}--o{ ${table.name} : "${fk.from}"`;
}

function render(tables: Table[]): string {
    const lines = [
        "# Modelo do banco de dados",
        "",
        "<!-- Gerado por `npm run schema:diagram` (backend/scripts/schema-diagram.ts) a partir das migrations. Não edite à mão. -->",
        "",
        "Gerado rodando todas as migrations em um SQLite em memória. Os tipos são os registrados pelo SQLite;",
        "tabelas, colunas e relações são as mesmas do Postgres de produção.",
        "",
        `${tables.length} tabelas. Legenda: PK chave primária, FK chave estrangeira, UK única.`,
        "",
        "```mermaid",
        "erDiagram",
    ];
    for (const table of tables) {
        lines.push(`    ${table.name} {`);
        lines.push(...table.columns.map(attribute));
        lines.push("    }");
    }
    lines.push("");
    for (const table of tables)
        for (const fk of table.foreignKeys)
            lines.push(relationship(table, fk));
    lines.push("```", "");
    return lines.join("\n");
}

async function main() {
    const check = process.argv.includes("--check");
    const db = migrationDb();
    try {
        await db.migrate.latest();
        const markdown = render(await readSchema(db));

        if (check) {
            const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
            if (current !== markdown) {
                console.error(`${path.relative(process.cwd(), OUTPUT)} is out of date. Run: npm run schema:diagram`);
                process.exitCode = 1;
            } else {
                console.log("Schema diagram is up to date.");
            }
            return;
        }

        fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
        fs.writeFileSync(OUTPUT, markdown);
        console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`);
    } finally {
        await db.destroy();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
