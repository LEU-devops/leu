import type { Knex } from "knex";

/**
 * The Copas as a history.
 *
 * 1. Cups and editions. A cup is the competition ("Copa Eng", "Copa Bixo", "InterGestões"); an
 *    edition is one year of it (at most one per year), optionally shown under another name. One
 *    edition in the whole app is current: the one the Copa pages focus on. Modalities are a
 *    catalog shared by every edition; `edition_modalities` says which ones each edition has.
 *
 * 2. Participants. The `teams` table goes away: who plays a Copa is an organization, listed per
 *    edition in `edition_organizations` with the name it shows in that edition (e.g. "FEA") and
 *    its supporters bonus and penalty points. `organizations.short_name` is the default name.
 *    Matches, registrations and event results point to organizations (their columns keep the
 *    word "team": a team of the Copa is the organization playing it) and belong to an edition.
 *    Organizations cannot be deleted while they have Copa history (no cascade).
 *
 * 3. Results. The final classification of an edition (overall and per modality) is saved, so old
 *    champions can be logged without brackets and closed editions do not change if the scoring
 *    rules do. Closing an edition saves its live standings there.
 *
 * 4. Participations: a team taking part in a championship, with its athletes, its result and
 *    the individual awards given there.
 *      - kind "externo": any championship (TUSCA...), created by the team's DMs or the sports
 *        board; the result is typed in.
 *      - kind "copa": an organization in a modality of a Copa edition; the result comes from the
 *        edition's results (or live standings while it runs), the sports board picks the athletes.
 *    Team awards ("equipe") become externo participations, since that is what they were.
 *
 * Existing Copa data goes to a first, current "Copa Eng" edition. Old teams are matched to
 * organizations by name; whatever a team without an organization played is dropped.
 */

/** Copa team names → organization names when they do not follow "AAA" + name. */
const TEAM_ALIASES: Record<string, string> = { FEEC: "AAAFEE", EQ: "AAAFEQ", AKI: "AAAKI" };

const PLACEMENT_NUMBER: Record<string, number> = { ouro: 1, prata: 2, bronze: 3 };

function isPostgres(knex: Knex): boolean {
    return knex.client.config.client === "pg";
}

function insertedId(row: unknown): number {
    return typeof row === "object" && row !== null ? (row as { id: number }).id : (row as number);
}

/** References to an organization never cascade: an organization with Copa history cannot be deleted. */
function organization(table: Knex.CreateTableBuilder, column: string) {
    return table.integer(column).references("id").inTable("organizations").onDelete("RESTRICT");
}

/**
 * Swaps `<name>_new` in for `<name>`. Nothing references the tables rebuilt here (matches only
 * references itself), so dropping the old one never trips a foreign key.
 */
async function replaceTable(knex: Knex, name: string) {
    await knex.schema.dropTable(name);
    await knex.schema.renameTable(`${name}_new`, name);
}

export async function up(knex: Knex): Promise<void> {
    // --- 1. Cups, editions, modalities ---
    await knex.schema.createTable("cups", (table) => {
        table.increments("id").primary();
        table.string("name").notNullable().unique();
    });
    await knex.schema.createTable("copa_editions", (table) => {
        table.increments("id").primary();
        table.integer("cup_id").notNullable().references("id").inTable("cups").onDelete("RESTRICT");
        table.integer("year").notNullable();
        table.string("name"); // shown instead of the cup's name when set
        table.boolean("is_current").notNullable().defaultTo(false);
        table.boolean("finished").notNullable().defaultTo(false);
        table.unique(["cup_id", "year"]);
    });
    const cupId = insertedId((await knex("cups").insert({ name: "Copa Eng" }).returning("id"))[0]);
    const editionId = insertedId((await knex("copa_editions")
        .insert({ cup_id: cupId, year: new Date().getFullYear(), is_current: true })
        .returning("id"))[0]);

    await knex.schema.createTable("edition_modalities", (table) => {
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        table.string("modality_code", 3).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        table.primary(["edition_id", "modality_code"]);
    });
    const modalities = await knex("modalities").select("code");
    if (modalities.length > 0)
        await knex("edition_modalities").insert(modalities.map((modality) => ({ edition_id: editionId, modality_code: modality.code })));

    await knex.raw("ALTER TABLE time_slots ADD COLUMN edition_id INTEGER REFERENCES copa_editions(id) ON DELETE CASCADE");
    await knex("time_slots").update({ edition_id: editionId });

    // --- 2. Participants ---
    await knex.raw("ALTER TABLE organizations ADD COLUMN short_name TEXT");
    await knex.schema.createTable("edition_organizations", (table) => {
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        organization(table, "organization_id").notNullable();
        table.string("display_name").notNullable();
        table.boolean("bonus_torcida").notNullable().defaultTo(false);
        table.integer("penalty_points").notNullable().defaultTo(0);
        table.primary(["edition_id", "organization_id"]);
        table.unique(["edition_id", "display_name"]);
    });

    const orgByName = new Map((await knex("organizations").select("id", "name")).map((org) => [String(org.name).toUpperCase(), org.id as number]));
    const orgOfTeam = new Map<number, number>();
    for (const team of await knex("teams").select("*")) {
        const name = String(team.name).toUpperCase();
        const organizationId = orgByName.get(TEAM_ALIASES[name] ?? "") ?? orgByName.get(`AAA${name}`) ?? orgByName.get(name);
        if (organizationId === undefined || [...orgOfTeam.values()].includes(organizationId)) continue;
        orgOfTeam.set(team.id, organizationId);
        await knex("edition_organizations").insert({
            edition_id: editionId,
            organization_id: organizationId,
            display_name: team.name,
            bonus_torcida: Boolean(team.bonus_torcida),
            penalty_points: team.penalty_points ?? 0,
        });
        await knex("organizations").where({ id: organizationId }).whereNull("short_name").update({ short_name: team.name });
    }
    const org = (teamId: number | null) => (teamId === null ? null : orgOfTeam.get(teamId) ?? null);

    await knex.schema.createTable("matches_new", (table) => {
        table.increments("id");
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        table.string("modality_code", 3).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        table.string("stage").notNullable();
        table.integer("round").notNullable();
        table.integer("position").notNullable();
        organization(table, "team_a_id");
        organization(table, "team_b_id");
        table.string("score_a");
        table.string("score_b");
        organization(table, "winner_id");
        table.integer("next_match_id").references("id").inTable("matches_new");
        table.string("next_slot");
        table.string("status").notNullable().defaultTo("scheduled");
        table.datetime("scheduled_at");
        table.integer("venue_id").references("id").inTable("venues").onDelete("SET NULL");
        organization(table, "redator_team_id");
        organization(table, "mesario_team_id");
        table.boolean("walkover").notNullable().defaultTo(false);
        table.unique(["edition_id", "modality_code", "round", "position"], { indexName: "matches_edition_id_modality_code_round_position_unique" });
    });
    const matches = await knex("matches").select("*");
    for (const match of matches) {
        await knex("matches_new").insert({
            ...match,
            edition_id: editionId,
            team_a_id: org(match.team_a_id),
            team_b_id: org(match.team_b_id),
            winner_id: org(match.winner_id),
            redator_team_id: org(match.redator_team_id),
            mesario_team_id: org(match.mesario_team_id),
            next_match_id: null,
        });
    }
    for (const match of matches.filter((row) => row.next_match_id !== null))
        await knex("matches_new").where({ id: match.id }).update({ next_match_id: match.next_match_id });
    await replaceTable(knex, "matches");

    await knex.schema.createTable("registrations_new", (table) => {
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        table.string("modality_code", 3).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        organization(table, "team_id").notNullable();
        table.primary(["edition_id", "modality_code", "team_id"]);
    });
    for (const registration of await knex("registrations").select("*")) {
        if (org(registration.team_id) !== null)
            await knex("registrations_new").insert({ edition_id: editionId, modality_code: registration.modality_code, team_id: org(registration.team_id) });
    }
    await replaceTable(knex, "registrations");

    await knex.raw("ALTER TABLE events ADD COLUMN edition_id INTEGER REFERENCES copa_editions(id) ON DELETE CASCADE");
    await knex("events").update({ edition_id: editionId });
    await knex.schema.alterTable("events", (table) => {
        table.dropUnique(["modality_code", "name"]);
        table.unique(["edition_id", "modality_code", "name"]);
    });

    await knex.schema.createTable("event_results_new", (table) => {
        table.integer("event_id").notNullable().references("id").inTable("events").onDelete("CASCADE");
        organization(table, "team_id").notNullable();
        table.integer("position").notNullable();
        table.primary(["event_id", "position"]);
    });
    for (const result of await knex("event_results").select("*")) {
        if (org(result.team_id) !== null)
            await knex("event_results_new").insert({ ...result, team_id: org(result.team_id) });
    }
    await replaceTable(knex, "event_results");

    await knex.schema.dropTable("teams");
    if (isPostgres(knex))
        await knex.raw("SELECT setval(pg_get_serial_sequence('matches', 'id'), COALESCE((SELECT MAX(id) FROM matches), 0) + 1, false)");

    // --- 3. Results ---
    await knex.schema.createTable("edition_results", (table) => {
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        organization(table, "organization_id").notNullable();
        table.integer("position").notNullable(); // 1 = champion; ties share a position
        table.integer("points"); // final total, when known
        table.primary(["edition_id", "organization_id"]);
    });
    await knex.schema.createTable("modality_results", (table) => {
        table.integer("edition_id").notNullable().references("id").inTable("copa_editions").onDelete("CASCADE");
        table.string("modality_code", 3).notNullable().references("code").inTable("modalities").onDelete("CASCADE");
        organization(table, "organization_id").notNullable();
        table.integer("position").notNullable();
        table.primary(["edition_id", "modality_code", "organization_id"]);
    });

    // --- 5. Participations ---
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
        table.integer("edition_id").references("id").inTable("copa_editions").onDelete("CASCADE");
        table.string("modality_code", 3).references("code").inTable("modalities").onDelete("CASCADE");
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.unique(["edition_id", "modality_code", "organization_id"]);
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

/** Irreversible: the old `teams` cannot be rebuilt from the organizations. Recreate the database instead. */
export async function down(): Promise<void> {
    throw new Error("20261112120000_copa_editions_and_participations cannot be rolled back; recreate the database (migrate + seed)");
}
