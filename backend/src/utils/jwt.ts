import jwt, { JwtPayload } from "jsonwebtoken";
import { UserPayload } from "../types/users";


const JWT_SECRET = process.env.JWT_SECRET || "secret-key";
const JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] = process.env.JWT_EXPIRES_IN as any || "1h";

export function signToken(payload: UserPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
}

export function verifyToken(token: string): UserPayload {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    return decoded as UserPayload;
}
