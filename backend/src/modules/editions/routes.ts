import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
    ConflictError,
    createCup,
    createEdition,
    deleteCup,
    deleteEdition,
    getEdition,
    listCups,
    listEditions,
    NotFoundError,
    renameCup,
    updateEdition,
    ValidationError,
} from "./controller";
import { addModalityToEdition, removeModalityFromEdition } from "../modalities/controller";
import { addTeam, listTeams, removeTeam, updateTeam } from "../teams/controller";
import { closeEdition, getResults, reopenEdition, setResults } from "../results/controller";

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError("id must be a positive integer");
    return id;
}

function translateErrors(err: Error, _req: Request, res: Response, next: NextFunction) {
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ message: err.message });
    next(err);
}

// --- CUPS (/cups) ---

export const cupsRouter = Router();

/** Public: every cup ("Copa Eng", "Copa Bixo"...), by name. */
cupsRouter.get("/", async (_req: Request, res: Response) => {
    res.json(await listCups());
});

/** Body: `{ name }`. */
cupsRouter.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createCup(req.body ?? {}));
});

/** Body: `{ name }`. */
cupsRouter.put("/:id", ...canManage, async (req: Request, res: Response) => {
    res.json(await renameCup(parseId(req.params.id), req.body ?? {}));
});

/** Only a cup without editions. */
cupsRouter.delete("/:id", ...canManage, async (req: Request, res: Response) => {
    await deleteCup(parseId(req.params.id));
    res.sendStatus(204);
});

cupsRouter.use(translateErrors);

// --- EDITIONS (/copa-editions) ---

const router = Router();

/** Public: every edition (of `?cup_id=` when given), newest first; `is_current` marks the one shown by default. */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listEditions({ cupId: req.query.cup_id === undefined ? undefined : parseId(req.query.cup_id) }));
});

/**
 * Body: `{ cupId, year, name?: string (shown instead of the cup's name), makeCurrent?: boolean }`.
 * Starts with the modalities and teams of the cup's last edition.
 */
router.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createEdition(req.body ?? {}));
});

/** Body: any of `{ cupId, year, name, isCurrent: true }`. */
router.put("/:id", ...canManage, async (req: Request, res: Response) => {
    res.json(await updateEdition(parseId(req.params.id), req.body ?? {}));
});

router.delete("/:id", ...canManage, async (req: Request, res: Response) => {
    await deleteEdition(parseId(req.params.id));
    res.sendStatus(204);
});

/** Adds a catalog modality to the edition. */
router.put("/:id/modalities/:code", ...canManage, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await getEdition(id);
    await addModalityToEdition({ editionId: id, code: String(req.params.code).toUpperCase() });
    res.sendStatus(204);
});

/** Takes a modality out of the edition; only when nothing was played in it there. */
router.delete("/:id/modalities/:code", ...canManage, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await getEdition(id);
    await removeModalityFromEdition({ editionId: id, code: String(req.params.code).toUpperCase() });
    res.sendStatus(204);
});

// Teams: the organizations playing the edition (a team's id is its organization id).

/** Public: the teams of the edition with their names there and their bonus/penalty. */
router.get("/:id/teams", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await getEdition(id);
    res.json(await listTeams(id));
});

/** Body: `{ organizationId, displayName? }` (default: the organization's short name). */
router.post("/:id/teams", ...canManage, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await getEdition(id);
    res.status(201).json(await addTeam(id, req.body ?? {}));
});

/** Body: any of `{ displayName, bonusTorcida, penaltyPoints }`. */
router.put("/:id/teams/:organizationId", ...canManage, async (req: Request, res: Response) => {
    res.json(await updateTeam(parseId(req.params.id), parseId(req.params.organizationId), req.body ?? {}));
});

/** Only a team that has not played or been ranked in the edition. */
router.delete("/:id/teams/:organizationId", ...canManage, async (req: Request, res: Response) => {
    await removeTeam(parseId(req.params.id), parseId(req.params.organizationId));
    res.sendStatus(204);
});

// Results: the saved final classification, overall and per modality.

/** Public. */
router.get("/:id/results", async (req: Request, res: Response) => {
    res.json(await getResults(parseId(req.params.id)));
});

/** Body: `{ scope: "overall" | <modality code>, entries: [{ organizationId, position, points? }] }`. Replaces that scope. */
router.put("/:id/results", ...canManage, async (req: Request, res: Response) => {
    res.json(await setResults(parseId(req.params.id), req.body ?? {}));
});

/** Saves the live standings as the final results and marks the edition finished. */
router.post("/:id/close", ...canManage, async (req: Request, res: Response) => {
    res.json(await closeEdition(parseId(req.params.id)));
});

router.post("/:id/reopen", ...canManage, async (req: Request, res: Response) => {
    res.json(await reopenEdition(parseId(req.params.id)));
});

router.use(translateErrors);

export default router;
