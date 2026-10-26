import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("users", (table) => {
        table.string("email").primary();
        table.string("password").notNullable();
        table.string("name").notNullable();
    });

    await knex.schema.createTable("permissions", (table) => {
        table.string("email")
            .notNullable()
            .references("email")
            .inTable("users")
            .onDelete("CASCADE");
        table.string("permission").notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("users");
    await knex.schema.dropTableIfExists("permissions");
}
