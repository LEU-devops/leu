import { db } from "../../services/db";
import { UserPayload, UserRegistrationData } from "../../types/users";
import { hashPassword, verifyPassword } from "../../utils/passwords";

export async function registerUser({ email, password, name }: UserRegistrationData) {
    const passwordHash = await hashPassword(password);

    return await db.execute(`
        INSERT INTO users (email, password, name, balance)
        VALUES (?, ?, ?, ?)
    `, [email, passwordHash, name, 10_000]);
}

export async function getUserPayload(email: string): Promise<UserPayload> {
    const user = await db.execute(`
        SELECT email, name, admin
        FROM users
        WHERE email = ?
    `, [email]);
    console.log(user)
    if (user.rows.length === 0)
        throw new Error(`User with email ${email} not found`);

    return {
        email,
        name: String(user.rows[0].name),
        admin: Boolean(user.rows[0].admin),
    }
}

export async function validateUserAuth(email: string, password: string) {
    const rows = await db.execute(`
        SELECT password
        FROM users
        WHERE email = ?
    `, [email]);

    if (rows.rows.length === 0)
        return false;

    const passwordHash = String(rows.rows[0].password);

    return passwordHash && await verifyPassword(password, passwordHash);
}