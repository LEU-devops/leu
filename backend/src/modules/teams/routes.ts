import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { resolveEditionId } from "../editions/controller";
import { getTeam, listTeams, NotFoundError, setTeamOrganization, setTeamScoring, ValidationError } from "./controller";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0)
        throw new ValidationError("id must be a positive integer");
    return id;
}

/** Public list of every Copa team, with its organization and its bonus_torcida/penalty_points in `?edition=<id>` (default: current). */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listTeams(await resolveEditionId(req.query.edition)));
});

/** A single team, with its scoring adjustments in `?edition=<id>`. */
router.get("/:id", async (req: Request, res: Response) => {
    res.json(await getTeam(parseId(req.params.id), await resolveEditionId(req.query.edition)));
});

/**
 * Body: { "bonusTorcida": true, "penaltyPoints": 3, "editionId"?: 2 }. Both fields are optional, at
 * least one is required; the ones left out keep their value. Responds with the updated team.
 */
router.put("/:id/scoring", ...canManage, async (req: Request, res: Response) => {
    res.json(await setTeamScoring(parseId(req.params.id), await resolveEditionId(req.body?.editionId), req.body ?? {}));
});

/** Body: { "organizationId": 3 | null }. Links the team to its AAA. */
router.put("/:id/organization", ...canManage, async (req: Request, res: Response) => {
    res.json(await setTeamOrganization(parseId(req.params.id), await resolveEditionId(undefined), req.body ?? {}));
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
