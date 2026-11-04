import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("organizations", (table) => {
        table.increments("id").primary();
        table.string("name").notNullable().unique();
        table.string("description");
    });

    await knex.schema.createTable("organization_users", (table) => {
        table.integer("organization_id")
            .notNullable()
            .references("id")
            .inTable("organizations")
            .onDelete("CASCADE");

        table.string("user_email")
            .notNullable()
            .references("email")
            .inTable("users")
            .onDelete("CASCADE");

        table.string("role").notNullable();
        table.string("director_area");

        table.primary(["organization_id", "user_email"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("organization_users");
    await knex.schema.dropTableIfExists("organizations");
}
