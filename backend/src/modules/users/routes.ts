import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { NotFoundError, searchUsers } from "../organizations/controller";
import { getPublicProfile } from "./controller";

const router = Router();

/** User search (name, nickname, e-mail) for pickers: members, rosters, award recipients. */
router.get("/search", authMiddleware, async (req: Request, res: Response) => {
    res.json(await searchUsers(String(req.query.q ?? "")));
});

/** Public profile: positions, teams and awards. */
router.get("/:email/profile", async (req: Request, res: Response) => {
    res.json(await getPublicProfile(String(req.params.email)));
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof NotFoundError)
        return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
