import type { Knex } from "knex";

/**
 * Turns "current membership" rows into periods, so the history of who held each role is kept
 * (like a LinkedIn timeline). A period with `ended_on = NULL` is current. Dates are stored as
 * "YYYY-MM-DD" text so SQLite and Postgres return the same thing.
 *
 * - organization_users  → organization_positions
 * - sports_team_members → sports_team_stints, where being an athlete and being a DM are
 *   separate periods ("Atleta 2023–2026" and "DM 2024" on the same team).
 *
 * Existing rows become open periods starting on the migration day; managers can fix the
 * dates later in the history editors.
 */

function today(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("organization_positions", (table) => {
        table.increments("id").primary();
        table.integer("organization_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        table.string("user_email").notNullable().references("email").inTable("users").onDelete("CASCADE").onUpdate("CASCADE");
        table.string("role").notNullable();
        table.string("director_area");
        table.string("started_on", 10).notNullable();
        table.string("ended_on", 10);
        table.index(["user_email"]);
    });
    // At most one current position per person in each organization.
    await knex.raw(
        "CREATE UNIQUE INDEX organization_positions_one_current ON organization_positions (organization_id, user_email) WHERE ended_on IS NULL",
    );

    await knex.schema.createTable("sports_team_stints", (table) => {
        table.increments("id").primary();
        table.integer("team_id").notNullable().references("id").inTable("sports_teams").onDelete("CASCADE");
        table.string("user_email").notNullable().references("email").inTable("users").onDelete("CASCADE").onUpdate("CASCADE");
        table.string("role").notNullable(); // "atleta" | "dm"
        table.string("started_on", 10).notNullable();
        table.string("ended_on", 10);
        table.index(["user_email"]);
    });
    await knex.raw(
        "CREATE UNIQUE INDEX sports_team_stints_one_current ON sports_team_stints (team_id, user_email, role) WHERE ended_on IS NULL",
    );

    const startedOn = today();

    const positions = await knex("organization_users").select("organization_id", "user_email", "role", "director_area");
    if (positions.length > 0)
        await knex("organization_positions").insert(positions.map((row) => ({ ...row, started_on: startedOn, ended_on: null })));

    const members = await knex("sports_team_members").select("team_id", "user_email", "is_dm");
    if (members.length > 0)
        await knex("sports_team_stints").insert(members.map((row) => ({
            team_id: row.team_id,
            user_email: row.user_email,
            role: row.is_dm ? "dm" : "atleta",
            started_on: startedOn,
            ended_on: null,
        })));

    await knex.schema.dropTable("sports_team_members");
    await knex.schema.dropTable("organization_users");
}

/** Back to current-only rows; past periods are lost. */
export async function down(knex: Knex): Promise<void> {
    await knex.schema.createTable("organization_users", (table) => {
        table.integer("organization_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        table.string("user_email").notNullable().references("email").inTable("users").onDelete("CASCADE");
        table.string("role").notNullable();
        table.string("director_area");
        table.primary(["organization_id", "user_email"]);
    });
    await knex.schema.createTable("sports_team_members", (table) => {
        table.integer("team_id").notNullable().references("id").inTable("sports_teams").onDelete("CASCADE");
        table.string("user_email").notNullable().references("email").inTable("users").onDelete("CASCADE").onUpdate("CASCADE");
        table.boolean("is_dm").notNullable().defaultTo(false);
        table.primary(["team_id", "user_email"]);
    });

    const positions = await knex("organization_positions").whereNull("ended_on").select("organization_id", "user_email", "role", "director_area");
    if (positions.length > 0) await knex("organization_users").insert(positions);

    const stints = await knex("sports_team_stints").whereNull("ended_on").select("team_id", "user_email", "role");
    const members = new Map<string, { team_id: number, user_email: string, is_dm: boolean }>();
    for (const stint of stints) {
        const key = `${stint.team_id}|${stint.user_email}`;
        const member = members.get(key) ?? { team_id: stint.team_id, user_email: stint.user_email, is_dm: false };
        member.is_dm ||= stint.role === "dm";
        members.set(key, member);
    }
    if (members.size > 0) await knex("sports_team_members").insert([...members.values()]);

    await knex.schema.dropTable("sports_team_stints");
    await knex.schema.dropTable("organization_positions");
}
