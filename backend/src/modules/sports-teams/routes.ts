import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../organizations/controller";
import {
    createSportsTeam,
    deleteSportsTeam,
    getSportsTeam,
    getSportsTeamPermissions,
    listSportsTeams,
    renameSportsTeam,
    setSportsTeamRoster,
} from "./controller";

const router = Router();

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0)
        throw new ValidationError("id must be a positive integer");
    return id;
}

/** Public list of teams with rosters; `?organization_id=` narrows to one organization. */
router.get("/", async (req: Request, res: Response) => {
    const organizationId = req.query.organization_id === undefined ? undefined : parseId(req.query.organization_id);
    res.json(await listSportsTeams({ organizationId }));
});

/** Public team page data: roster and awards. */
router.get("/:id", async (req: Request, res: Response) => {
    res.json(await getSportsTeam(parseId(req.params.id)));
});

router.get("/:id/permissions", authMiddleware, async (req: Request, res: Response) => {
    res.json(await getSportsTeamPermissions(req.user!.email, parseId(req.params.id)));
});

/** Body: `{ organization_id, name }`. */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    res.status(201).json(await createSportsTeam(req.user!.email, req.body ?? {}));
});

/** Body: `{ name }`. */
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
    res.json(await renameSportsTeam(req.user!.email, parseId(req.params.id), req.body ?? {}));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
    await deleteSportsTeam(req.user!.email, parseId(req.params.id));
    res.sendStatus(204);
});

/** Replaces the roster. Body: `{ members: [{ email, is_dm }] }`. */
router.put("/:id/members", authMiddleware, async (req: Request, res: Response) => {
    res.json(await setSportsTeamRoster(req.user!.email, parseId(req.params.id), req.body ?? {}));
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof ForbiddenError) return res.status(403).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ message: err.message });
    next(err);
});

export default router;
