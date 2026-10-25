import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
    ConflictError,
    createBracket,
    createModality,
    getBracket,
    getModality,
    listModalities,
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

/** Body: { "teams": ["Time 1", "Time 2", ...] } (2 to 16 names, bracket order top to bottom). */
router.post("/:code/bracket", ...canManage, async (req: Request, res: Response) => {
    const code = String(req.params.code).toUpperCase();
    res.status(201).json(await createBracket(code, req.body?.teams));
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
