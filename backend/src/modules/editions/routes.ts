import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { ConflictError, createEdition, deleteEdition, listEditions, NotFoundError, updateEdition, ValidationError } from "./controller";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError("id must be a positive integer");
    return id;
}

/** Public: every Copa edition, newest first; `is_current` marks the one shown by default. */
router.get("/", async (_req: Request, res: Response) => {
    res.json(await listEditions());
});

/** Body: `{ name, year, copyModalitiesFrom?: editionId, makeCurrent?: boolean }`. */
router.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createEdition(req.body ?? {}));
});

router.put("/:id", ...canManage, async (req: Request, res: Response) => {
    res.json(await updateEdition(parseId(req.params.id), req.body ?? {}));
});

router.delete("/:id", ...canManage, async (req: Request, res: Response) => {
    await deleteEdition(parseId(req.params.id));
    res.sendStatus(204);
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    if (err instanceof ConflictError) return res.status(409).json({ message: err.message });
    next(err);
});

export default router;
