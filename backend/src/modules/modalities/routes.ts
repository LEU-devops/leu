import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
    clearMatchResult,
    ConflictError,
    createBracket,
    createModality,
    getBracket,
    getModality,
    listModalities,
    setMatchResult,
    ValidationError,
} from "./controller";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

// --- MODALITIES ---
router.get("/", async (_req: Request, res: Response) => {
    res.json(await listModalities());
});

router.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createModality(req.body ?? {}));
});

router.get("/:code", async (req: Request, res: Response) => {
    const modality = await getModality(String(req.params.code).toUpperCase());
    if (!modality)
        return res.status(404).json({ message: "Modality not found" });
    res.json(modality);
});

// --- BRACKET ---
router.get("/:code/bracket", async (req: Request, res: Response) => {
    const code = String(req.params.code).toUpperCase();
    if (!await getModality(code))
        return res.status(404).json({ message: "Modality not found" });
    res.json(await getBracket(code));
});

/**
 * Body: { "slots": ["Time 1", "Time 2", null, "Time 3", ...] }
 * First-round slots top to bottom (length 2, 4, 8 or 16); null marks a bye for the slot's opponent.
 */
router.post("/:code/bracket", ...canManage, async (req: Request, res: Response) => {
    const code = String(req.params.code).toUpperCase();
    res.status(201).json(await createBracket(code, req.body?.slots));
});

// --- RESULTS ---

/** Body: { "scoreA": "2", "scoreB": "2 (4)", "winner": "a" | "b" }. Responds with the whole bracket. */
router.put("/:code/matches/:id/result", ...canManage, async (req: Request, res: Response) => {
    const code = String(req.params.code).toUpperCase();
    res.json(await setMatchResult(code, Number(req.params.id), req.body ?? {}));
});

/** Reverts a match to unresolved. Responds with the whole bracket. */
router.delete("/:code/matches/:id/result", ...canManage, async (req: Request, res: Response) => {
    const code = String(req.params.code).toUpperCase();
    res.json(await clearMatchResult(code, Number(req.params.id)));
});

// Translate the controller errors of this module into HTTP statuses.
router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError)
        return res.status(400).json({ message: err.message });
    if (err instanceof ConflictError)
        return res.status(409).json({ message: err.message });
    next(err);
});

export default router;
