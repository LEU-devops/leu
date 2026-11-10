import type { Knex } from "knex";
import { hashPassword } from "../../src/utils/passwords";
import { DEV_EMAIL, PEOPLE, SEED_PASSWORD } from "../seed-utils";

/**
 * Every user logs in with the password "123456". `dev@test.com` can manage the Copas
 * ("criar-chaveamento") and, as LEU president (02_organizations), every entity.
 */
export async function seed(knex: Knex): Promise<void> {
    const password = await hashPassword(SEED_PASSWORD);
    await knex("users").insert(PEOPLE.map((person, index) => ({
        email: person.email,
        nickname: person.nickname,
        full_name: person.full_name,
        password,
        ra: person.email === DEV_EMAIL ? "000000" : String(200000 + index * 137),
        cpf: null,
        profile_photo_url: null,
    })));
    await knex("permissions").insert({ email: DEV_EMAIL, permission: "criar-chaveamento" });
}
