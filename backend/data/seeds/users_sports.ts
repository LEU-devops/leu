import type { Knex } from "knex";

/**
 * Example sports teams, rosters (with DMs) and awards. Runs after `users.ts` (alphabetical
 * order), which recreates the organizations and users these rows point to.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex("participation_athletes").del();
  await knex("award_recipients").del();
  await knex("awards").del();
  await knex("participations").del();
  await knex("awards").del();
  await knex("sports_team_stints").del();
  await knex("sports_teams").del();

  await knex("sports_teams").insert([
    { id: 1, organization_id: 1, name: "Vôlei Masculino" },
    { id: 2, organization_id: 1, name: "Futsal Feminino" },
    { id: 3, organization_id: 2, name: "Basquete Masculino" },
  ]);

  const CURRENT = { started_on: "2026-01-01", ended_on: null };
  await knex("sports_team_stints").insert([
    // Current rosters
    { team_id: 1, user_email: "user7@example.com", role: "dm", ...CURRENT },
    { team_id: 1, user_email: "user7@example.com", role: "atleta", ...CURRENT },
    { team_id: 1, user_email: "user8@example.com", role: "atleta", ...CURRENT },
    { team_id: 1, user_email: "user1@example.com", role: "atleta", ...CURRENT },
    { team_id: 2, user_email: "user11@example.com", role: "dm", ...CURRENT },
    { team_id: 2, user_email: "user12@example.com", role: "dm", ...CURRENT },
    { team_id: 2, user_email: "user6@example.com", role: "atleta", ...CURRENT },
    { team_id: 3, user_email: "user15@example.com", role: "dm", ...CURRENT },
    { team_id: 3, user_email: "user16@example.com", role: "atleta", ...CURRENT },
    // History: athlete of Vôlei Masculino since 2023, DM there in 2024
    { team_id: 1, user_email: "user6@example.com", role: "atleta", started_on: "2023-03-01", ended_on: null },
    { team_id: 1, user_email: "user6@example.com", role: "dm", started_on: "2024-01-10", ended_on: "2024-12-15" },
    { team_id: 2, user_email: "user6@example.com", role: "dm", started_on: "2025-02-01", ended_on: "2025-11-30" },
  ]);

  // Past positions (the 2026 ones come from users.ts)
  await knex("organization_positions").insert([
    { organization_id: 1, user_email: "user1@example.com", role: "diretor", director_area: "Eventos", started_on: "2025-01-01", ended_on: "2025-12-31" },
    { organization_id: 1, user_email: "user1@example.com", role: "membro", director_area: null, started_on: "2024-03-01", ended_on: "2024-12-31" },
    { organization_id: 2, user_email: "user6@example.com", role: "vice", director_area: null, started_on: "2025-01-01", ended_on: "2025-12-31" },
  ]);

  // Championships of the LEU teams, with their athletes (team results are participations).
  await knex("participations").insert([
    { id: 1, kind: "externo", organization_id: 1, sports_team_id: 1, competition: "TUSCA", year: 2026, placement: 1 },
    { id: 2, kind: "externo", organization_id: 1, sports_team_id: 2, competition: "Engenharíadas", year: 2025, placement: 2 },
    { id: 3, kind: "externo", organization_id: 1, sports_team_id: 1, competition: "Liga Universitária", year: 2025, placement: null },
  ]);
  await knex("participation_athletes").insert([
    ...["user7", "user6", "user8", "user1"].map((user) => ({ participation_id: 1, user_email: `${user}@example.com` })),
    ...["user11", "user12", "user6"].map((user) => ({ participation_id: 2, user_email: `${user}@example.com` })),
    ...["user7", "user6"].map((user) => ({ participation_id: 3, user_email: `${user}@example.com` })),
  ]);

  await knex("awards").insert([
    { id: 1, organization_id: 1, sports_team_id: 1, participation_id: 1, kind: "individual", title: "MVP da Final", placement: null, competition: "TUSCA", year: 2026 },
    { id: 2, organization_id: 1, sports_team_id: 1, participation_id: null, kind: "individual", title: "Atleta Destaque", placement: null, competition: "Melhores do Ano", year: 2026 },
    { id: 4, organization_id: 1, sports_team_id: null, participation_id: null, kind: "individual", title: "Artilheira", placement: null, competition: "Copa Bixo", year: 2025 },
  ]);

  await knex("award_recipients").insert([
    { award_id: 1, user_email: "user7@example.com" },
    { award_id: 2, user_email: "user6@example.com" },
    { award_id: 4, user_email: "user6@example.com" },
  ]);

  // Copa teams ↔ AAAs (users.ts recreates the organizations, which clears this link).
  const aliases: Record<string, string> = { FEEC: "AAAFEE", AKI: "AAAKI" };
  for (const team of await knex("teams").select("id", "name")) {
    const organization = await knex("organizations").whereIn("name", [aliases[team.name] ?? "", `AAA${team.name}`, team.name]).first();
    if (organization) await knex("teams").where({ id: team.id }).update({ organization_id: organization.id });
  }

  // Postgres: explicit ids do not advance the sequences, so later inserts would collide.
  if (knex.client.config.client === "pg") {
    await knex.raw(
      "SELECT setval(pg_get_serial_sequence('sports_teams', 'id'), (SELECT MAX(id) FROM sports_teams))",
    );
    await knex.raw(
      "SELECT setval(pg_get_serial_sequence('awards', 'id'), (SELECT MAX(id) FROM awards))",
    );
    await knex.raw(
      "SELECT setval(pg_get_serial_sequence('participations', 'id'), (SELECT MAX(id) FROM participations))",
    );
  }
}
