import { db } from "../../services/db";
import { User, UserPayload } from "../../types/users";
import { hashPassword, verifyPassword } from "../../utils/passwords";

export async function registerUser({ email, password, name }: User) {
    const passwordHash = await hashPassword(password);

    await db("users").insert({
        email,
        password: passwordHash,
        name,
    });
}

export async function getUserPayload(email: string): Promise<UserPayload> {
    const user = await db("users")
        .select("email", "name")
        .where({ email })
        .first();

    if (!user)
        throw new Error(`User with email ${email} not found`);

    return {
        email: user.email,
        name: user.name,
    };
}

export async function validateUserAuth(email: string, password: string) {
    const user = await db("users")
        .select("password")
        .where({ email })
        .first();

    if (!user)
        return false;

    return await verifyPassword(password, user.password);
}
