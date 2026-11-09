import type { Knex } from "knex";

/**
 * Sports teams of each organization (LEU or AAA), their rosters (with DMs) and the awards
 * given to users. Not to be confused with `teams`, which are the AAAs competing in a Copa.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("sports_teams", (table) => {
        table.increments("id").primary();
        table.integer("organization_id")
            .notNullable()
            .references("id")
            .inTable("organizations")
            .onDelete("CASCADE");
        table.string("name").notNullable(); // ex.: "Vôlei Masculino"
        table.unique(["organization_id", "name"]);
    });

    await knex.schema.createTable("sports_team_members", (table) => {
        table.integer("team_id")
            .notNullable()
            .references("id")
            .inTable("sports_teams")
            .onDelete("CASCADE");
        table.string("user_email")
            .notNullable()
            .references("email")
            .inTable("users")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.boolean("is_dm").notNullable().defaultTo(false);
        table.primary(["team_id", "user_email"]);
    });

    await knex.schema.createTable("awards", (table) => {
        table.increments("id").primary();
        /** Who grants the award; its presidents and sports directors manage it. */
        table.integer("organization_id")
            .notNullable()
            .references("id")
            .inTable("organizations")
            .onDelete("CASCADE");
        /** Team the award refers to (required for team awards, optional for individual ones). */
        table.integer("sports_team_id")
            .references("id")
            .inTable("sports_teams")
            .onDelete("SET NULL");
        table.string("kind").notNullable(); // "individual" | "equipe"
        table.string("title").notNullable(); // ex.: "Atleta Destaque", "Campeão"
        table.string("placement"); // "ouro" | "prata" | "bronze" | null
        table.string("competition"); // ex.: "Copa Bixo", "TUSCA", "Melhores do Ano"
        table.integer("year").notNullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    });

    await knex.schema.createTable("award_recipients", (table) => {
        table.integer("award_id")
            .notNullable()
            .references("id")
            .inTable("awards")
            .onDelete("CASCADE");
        table.string("user_email")
            .notNullable()
            .references("email")
            .inTable("users")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.primary(["award_id", "user_email"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("award_recipients");
    await knex.schema.dropTableIfExists("awards");
    await knex.schema.dropTableIfExists("sports_team_members");
    await knex.schema.dropTableIfExists("sports_teams");
}
