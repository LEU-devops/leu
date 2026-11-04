import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TABLE users RENAME COLUMN name TO nickname");
  await knex.raw("ALTER TABLE users ADD COLUMN full_name TEXT");
  await knex.raw("ALTER TABLE users ADD COLUMN ra TEXT");
  await knex.raw("ALTER TABLE users ADD COLUMN cpf TEXT");
  await knex.raw("ALTER TABLE users ADD COLUMN profile_photo_url TEXT");

  await knex.raw("CREATE UNIQUE INDEX users_ra_unique ON users(ra)");
  await knex.raw("CREATE UNIQUE INDEX users_cpf_unique ON users(cpf)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS users_cpf_unique");
  await knex.raw("DROP INDEX IF EXISTS users_ra_unique");

  await knex.raw("ALTER TABLE users DROP COLUMN profile_photo_url");
  await knex.raw("ALTER TABLE users DROP COLUMN cpf");
  await knex.raw("ALTER TABLE users DROP COLUMN ra");
  await knex.raw("ALTER TABLE users DROP COLUMN full_name");
  await knex.raw("ALTER TABLE users RENAME COLUMN nickname TO name");
}
