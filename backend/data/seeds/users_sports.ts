import type { Knex } from "knex";

/**
 * Example sports teams, rosters (with DMs) and awards. Runs after `users.ts` (alphabetical
 * order), which recreates the organizations and users these rows point to.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex("award_recipients").del();
  await knex("awards").del();
  await knex("sports_team_members").del();
  await knex("sports_teams").del();

  await knex("sports_teams").insert([
    { id: 1, organization_id: 1, name: "Vôlei Masculino" },
    { id: 2, organization_id: 1, name: "Futsal Feminino" },
    { id: 3, organization_id: 2, name: "Basquete Masculino" },
  ]);

  await knex("sports_team_members").insert([
    { team_id: 1, user_email: "user7@example.com", is_dm: true },
    { team_id: 1, user_email: "user6@example.com", is_dm: false },
    { team_id: 1, user_email: "user8@example.com", is_dm: false },
    { team_id: 1, user_email: "user1@example.com", is_dm: false },
    { team_id: 2, user_email: "user11@example.com", is_dm: true },
    { team_id: 2, user_email: "user12@example.com", is_dm: true },
    { team_id: 2, user_email: "user6@example.com", is_dm: false },
    { team_id: 3, user_email: "user15@example.com", is_dm: true },
    { team_id: 3, user_email: "user16@example.com", is_dm: false },
  ]);

  await knex("awards").insert([
    {
      id: 1,
      organization_id: 1,
      sports_team_id: 1,
      kind: "equipe",
      title: "Campeão",
      placement: "ouro",
      competition: "TUSCA",
      year: 2026,
    },
    {
      id: 2,
      organization_id: 1,
      sports_team_id: 1,
      kind: "individual",
      title: "Atleta Destaque",
      placement: null,
      competition: "Melhores do Ano",
      year: 2026,
    },
    {
      id: 3,
      organization_id: 1,
      sports_team_id: 2,
      kind: "equipe",
      title: "Vice-campeão",
      placement: "prata",
      competition: "Copa Eng",
      year: 2025,
    },
    {
      id: 4,
      organization_id: 1,
      sports_team_id: null,
      kind: "individual",
      title: "Artilheira",
      placement: null,
      competition: "Copa Bixo",
      year: 2025,
    },
  ]);

  await knex("award_recipients").insert([
    { award_id: 1, user_email: "user7@example.com" },
    { award_id: 1, user_email: "user6@example.com" },
    { award_id: 1, user_email: "user8@example.com" },
    { award_id: 1, user_email: "user1@example.com" },
    { award_id: 2, user_email: "user6@example.com" },
    { award_id: 3, user_email: "user11@example.com" },
    { award_id: 3, user_email: "user12@example.com" },
    { award_id: 3, user_email: "user6@example.com" },
    { award_id: 4, user_email: "user6@example.com" },
  ]);

  // Postgres: explicit ids do not advance the sequences, so later inserts would collide.
  if (knex.client.config.client === "pg") {
    await knex.raw(
      "SELECT setval(pg_get_serial_sequence('sports_teams', 'id'), (SELECT MAX(id) FROM sports_teams))",
    );
    await knex.raw(
      "SELECT setval(pg_get_serial_sequence('awards', 'id'), (SELECT MAX(id) FROM awards))",
    );
  }
}
