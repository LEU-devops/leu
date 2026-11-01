import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { getTeam, listTeams, NotFoundError, setTeamScoring, ValidationError } from "./controller";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0)
        throw new ValidationError("id must be a positive integer");
    return id;
}

/** Public list of every team (with bonus_torcida and penalty_points), used to fill the bracket builder. */
router.get("/", async (_req: Request, res: Response) => {
    res.json(await listTeams());
});

/** A single team, including its scoring adjustments (bonus_torcida, penalty_points). */
router.get("/:id", async (req: Request, res: Response) => {
    res.json(await getTeam(parseId(req.params.id)));
});

// --- SCORING ADJUSTMENTS ---

/** The scoring adjustments of a team: { id, name, bonus_torcida, penalty_points }. */
router.get("/:id/scoring", async (req: Request, res: Response) => {
    res.json(await getTeam(parseId(req.params.id)));
});

/**
 * Body: { "bonusTorcida": true, "penaltyPoints": 3 }. Both fields are optional, at least one is required;
 * the ones left out keep their value. Responds with the updated team.
 */
router.put("/:id/scoring", ...canManage, async (req: Request, res: Response) => {
    res.json(await setTeamScoring(parseId(req.params.id), req.body ?? {}));
});

// Translate the controller errors of this module into HTTP statuses.
router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError)
        return res.status(400).json({ message: err.message });
    if (err instanceof NotFoundError)
        return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
