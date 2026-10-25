import { Request, Response, NextFunction } from "express";
import { db } from "../services/db";

/**
 * Requires `authMiddleware` to have run first. Responds 403 unless the
 * logged-in user has a row in `permissions` with the given permission.
 */
export function requirePermission(permission: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const email = req.user?.email;
        if (!email)
            return res.status(401).json({ message: "Unauthorized" });

        const row = await db("permissions")
            .where({ email, permission })
            .first();

        if (!row)
            return res.status(403).json({ message: `Missing permission: ${permission}` });

        next();
    };
}
