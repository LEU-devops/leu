import type { Knex } from "knex";

/**
 * 1. Copa editions (Copa Bixo 2025, Copa Eng 2026...). Modalities and base time slots belong to an
 *    edition; matches, events and registrations belong to a modality, so they follow it. The
 *    supporters bonus and penalty points of the AAAs become per edition.
 *
 *    `modalities.code` stays the primary key that matches/events/registrations reference, but it
 *    becomes an internal key, unique across editions; the code people see ("FM") moves to
 *    `short_code`, unique within an edition. Existing modalities keep their codes. This avoids
 *    rebuilding the tables that reference `modalities` (see the note in create_venues).
 *
 * 2. The Copa teams (the AAAs in the brackets) get linked to their organization.
 *
 * 3. Participations: a team taking part in a championship, with its athletes, its result and
 *    the individual awards given there.
 *      - kind "externo": any championship (TUSCA...), created by the team's DMs or the sports
 *        board; the result is typed in.
 *      - kind "copa": an AAA in a modality of a Copa edition; the result comes from the Copa
 *        standings, the sports board of the AAA picks the athletes.
 *    Team awards ("equipe") become externo participations, since that is what they were.
 */

const CODE_LENGTH = 16;

/** Copa team names → organization names when they do not follow "AAA" + name. */
const TEAM_ALIASES: Record<string, string> = { FEEC: "AAAFEE", EQ: "AAAFEQ", AKI: "AAAKI" };

const PLACEMENT_NUMBER: Record<string, number> = { ouro: 1, prata: 2, bronze: 3 };

function isPostgres(knex: Knex): boolean {
    return knex.client.config.client === "pg";
}

export async function up(knex: Knex): Promise<void> {
    // --- 1. Editions ---
    await knex.schema.createTable("copa_editions", (table) => {
        table.increments("id").primary();
        table.string("name").notNullable(); // "Copa Eng", "Copa Bixo"
        table.integer("year").notNullable();
        table.boolean("is_current").notNullable().defaultTo(false);
        table.unique(["name", "year"]);
    });
    const [first] = await knex("copa_editions")
        .insert({ name: "Copa Eng", year: new Date().getFullYear(), is_current: true })
        .returning("id");
    const editionId: number = typeof first === "object" ? first.id : first;

    if (isPostgres(knex)) {
        // Internal codes of later editions can be longer than 3 characters ("FM2").
        for (const [table, column] of [["modalities", "code"], ["matches", "modality_code"], ["events", "modality_code"], ["registrations", "modality_code"]])
            await knex.raw(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE varchar(${CODE_LENGTH})`);
    }

    await knex.raw("ALTER TABLE modalities ADD COLUMN edition_id INTEGER REFERENCES copa_editions(id) ON DELETE CASCADE");
    await knex.raw("ALTER TABLE modalities ADD COLUMN short_code TEXT");
    await knex("modalities").update({ edition_id: editionId, short_code: knex.ref("code") });
    await knex.raw("CREATE UNIQUE INDEX modalities_edition_short_code ON modalities (edition_id, short_code)");

    await knex.raw("ALTER TABLE time_slots ADD COLUMN edition_id INTEGER REFERENCES copa_editions(id) ON DELETE CASCADE");
    await knex("time_slots").update({ edition_id: editionId });

    await knex.schema.createTable("edition_team_scoring", (table) => {
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        table.integer("team_id").notNullable().references("id").inTable("teams").onDelete("CASCADE");
        table.boolean("bonus_torcida").notNullable().defaultTo(false);
        table.integer("penalty_points").notNullable().defaultTo(0);
        table.primary(["edition_id", "team_id"]);
    });
    const scoring = await knex("teams").select("id", "bonus_torcida", "penalty_points");
    const adjusted = scoring.filter((team) => Boolean(team.bonus_torcida) || team.penalty_points !== 0);
    if (adjusted.length > 0)
        await knex("edition_team_scoring").insert(adjusted.map((team) => ({
            edition_id: editionId,
            team_id: team.id,
            bonus_torcida: Boolean(team.bonus_torcida),
            penalty_points: team.penalty_points,
        })));
    await knex.raw("ALTER TABLE teams DROP COLUMN bonus_torcida");
    await knex.raw("ALTER TABLE teams DROP COLUMN penalty_points");

    // --- 2. Copa teams ↔ organizations ---
    await knex.raw("ALTER TABLE teams ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL");
    const organizations = await knex("organizations").select("id", "name");
    const orgByName = new Map(organizations.map((org) => [org.name.toUpperCase(), org.id]));
    for (const team of await knex("teams").select("id", "name")) {
        const name = String(team.name).toUpperCase();
        const organizationId = orgByName.get(TEAM_ALIASES[name] ?? "") ?? orgByName.get(`AAA${name}`) ?? orgByName.get(name);
        if (organizationId !== undefined)
            await knex("teams").where({ id: team.id }).update({ organization_id: organizationId });
    }

    // --- 3. Participations ---
    await knex.schema.createTable("participations", (table) => {
        table.increments("id").primary();
        table.string("kind").notNullable(); // "externo" | "copa"
        /** Whose participation it is: the team's organization (externo) or the AAA (copa). */
        table.integer("organization_id").notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        table.integer("sports_team_id").references("id").inTable("sports_teams").onDelete("SET NULL");
        // externo
        table.string("competition");
        table.integer("year");
        table.integer("placement"); // 1 = ouro, 2 = prata, 3 = bronze, 4+ = position, null = participação
        // copa
        table.string("modality_code", CODE_LENGTH).references("code").inTable("modalities").onDelete("CASCADE");
        table.integer("copa_team_id").references("id").inTable("teams").onDelete("CASCADE");
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.unique(["modality_code", "copa_team_id"]);
    });

    await knex.schema.createTable("participation_athletes", (table) => {
        table.integer("participation_id").notNullable().references("id").inTable("participations").onDelete("CASCADE");
        table.string("user_email").notNullable().references("email").inTable("users").onDelete("CASCADE").onUpdate("CASCADE");
        table.primary(["participation_id", "user_email"]);
    });

    await knex.raw("ALTER TABLE awards ADD COLUMN participation_id INTEGER REFERENCES participations(id) ON DELETE CASCADE");

    const teamAwards = await knex("awards").where({ kind: "equipe" }).select("*");
    for (const award of teamAwards) {
        const [row] = await knex("participations")
            .insert({
                kind: "externo",
                organization_id: award.organization_id,
                sports_team_id: award.sports_team_id,
                competition: award.competition ?? award.title,
                year: award.year,
                placement: award.placement ? PLACEMENT_NUMBER[award.placement] : null,
            })
            .returning("id");
        const participationId: number = typeof row === "object" ? row.id : row;
        const recipients = await knex("award_recipients").where({ award_id: award.id }).select("user_email");
        if (recipients.length > 0)
            await knex("participation_athletes").insert(recipients.map((recipient) => ({ participation_id: participationId, user_email: recipient.user_email })));
        await knex("award_recipients").where({ award_id: award.id }).delete();
        await knex("awards").where({ id: award.id }).delete();
    }
}

/**
 * Back to a single Copa: keeps the current edition's scoring on the teams and drops everything
 * else that is per edition; participations are lost. Postgres only: SQLite cannot drop columns
 * that have a foreign key (edition_id, organization_id, participation_id), so on the dev
 * database recreate it instead (migrate from scratch + seed).
 */
export async function down(knex: Knex): Promise<void> {
    await knex.raw("ALTER TABLE awards DROP COLUMN participation_id");
    await knex.schema.dropTable("participation_athletes");
    await knex.schema.dropTable("participations");

    await knex.raw("ALTER TABLE teams DROP COLUMN organization_id");

    await knex.raw("ALTER TABLE teams ADD COLUMN bonus_torcida BOOLEAN NOT NULL DEFAULT FALSE");
    await knex.raw("ALTER TABLE teams ADD COLUMN penalty_points INTEGER NOT NULL DEFAULT 0");
    const current = await knex("copa_editions").where({ is_current: true }).first();
    if (current) {
        for (const row of await knex("edition_team_scoring").where({ edition_id: current.id }))
            await knex.raw("UPDATE teams SET bonus_torcida = ?, penalty_points = ? WHERE id = ?", [Boolean(row.bonus_torcida), row.penalty_points, row.team_id]);
    }
    await knex.schema.dropTable("edition_team_scoring");

    await knex.raw("ALTER TABLE time_slots DROP COLUMN edition_id");
    await knex.raw("DROP INDEX IF EXISTS modalities_edition_short_code");
    await knex.raw("ALTER TABLE modalities DROP COLUMN short_code");
    await knex.raw("ALTER TABLE modalities DROP COLUMN edition_id");
    await knex.schema.dropTable("copa_editions");
}
