import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { ForbiddenError, NotFoundError, ValidationError } from "../organizations/controller";
import { createAward, deleteAward, listAwards } from "./controller";

const router = Router();

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0)
        throw new ValidationError("id must be a positive integer");
    return id;
}

/** Public list; filter with `?organization_id=`, `?team_id=` or `?email=`. */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listAwards({
        organizationId: req.query.organization_id === undefined ? undefined : parseId(req.query.organization_id),
        teamId: req.query.team_id === undefined ? undefined : parseId(req.query.team_id),
        email: req.query.email === undefined ? undefined : String(req.query.email),
    }));
});

/** Body: `{ organization_id, kind, title, placement, competition, year, sports_team_id, recipients: [email] }`. */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    res.status(201).json(await createAward(req.user!.email, req.body ?? {}));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
    await deleteAward(req.user!.email, parseId(req.params.id));
    res.sendStatus(204);
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof ForbiddenError) return res.status(403).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
