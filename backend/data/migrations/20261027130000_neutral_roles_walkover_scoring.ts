import type { Knex } from "knex";

/**
 * Three changes needed by the scoring features:
 *
 * 1. The single "neutra" of a match is split into two roles, both filled by a team:
 *      - redator: writes the match report (súmula);
 *      - mesário: runs the table/scoreboard.
 *    Existing rows get the current neutral team copied into both roles, then
 *    `neutral_team_id` is dropped.
 *
 * 2. A match can be decided by walkover (WO). The winning side keeps being `winner_id`;
 *    `walkover` only records *how* it was decided, so the scoring rules can treat WO
 *    wins/losses differently from played matches.
 *
 * 3. Adjustments to a team's overall score, outside of match results:
 *      - fan_bonus: whether the team earned the supporters ("torcida") bonus;
 *      - penalty_points: points to subtract from the team's total (0 = no penalty).
 *
 * Everything is raw SQL on purpose (same reason as create_venues): knex's alterTable would
 * rebuild the table on SQLite, which fails with foreign_keys ON because `matches`
 * references itself (next_match_id) and `teams` is referenced by `matches`. The typed query
 * builder is avoided too, since `Match` does not know the new columns yet. All statements
 * run unchanged on SQLite 3.35+ (dev) and Postgres (prod).
 */
export async function up(knex: Knex): Promise<void> {
    // 1. neutra -> redator + mesário
    await knex.raw("ALTER TABLE matches ADD COLUMN redator_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");
    await knex.raw("ALTER TABLE matches ADD COLUMN mesario_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");
    await knex.raw("UPDATE matches SET redator_team_id = neutral_team_id, mesario_team_id = neutral_team_id");
    await knex.raw("ALTER TABLE matches DROP COLUMN neutral_team_id");

    // 2. WO
    await knex.raw("ALTER TABLE matches ADD COLUMN walkover BOOLEAN NOT NULL DEFAULT FALSE");

    // 3. team score adjustments
    await knex.raw("ALTER TABLE teams ADD COLUMN bonus_torcida BOOLEAN NOT NULL DEFAULT FALSE");
    await knex.raw("ALTER TABLE teams ADD COLUMN penalty_points INTEGER NOT NULL DEFAULT 0");
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw("ALTER TABLE teams DROP COLUMN penalty_points");
    await knex.raw("ALTER TABLE teams DROP COLUMN bonus_torcida");

    await knex.raw("ALTER TABLE matches DROP COLUMN walkover");

    // Restore the single neutra from whichever role is filled (redator first).
    await knex.raw("ALTER TABLE matches ADD COLUMN neutral_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL");
    await knex.raw("UPDATE matches SET neutral_team_id = COALESCE(redator_team_id, mesario_team_id)");
    await knex.raw("ALTER TABLE matches DROP COLUMN mesario_team_id");
    await knex.raw("ALTER TABLE matches DROP COLUMN redator_team_id");
}
