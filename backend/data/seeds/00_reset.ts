import type { Knex } from "knex";

/** Empties every table (children first), so the seeds always start from a clean database. */
const TABLES = [
    "award_recipients",
    "awards",
    "participation_athletes",
    "participations",
    "event_results",
    "events",
    "registrations",
    "matches",
    "modality_results",
    "edition_results",
    "edition_organizations",
    "edition_modalities",
    "time_slots",
    "copa_editions",
    "cups",
    "modalities",
    "venues",
    "sports_team_stints",
    "sports_teams",
    "organization_positions",
    "organizations",
    "permissions",
    "users",
];

export async function seed(knex: Knex): Promise<void> {
    for (const table of TABLES)
        await knex(table).del();
}
