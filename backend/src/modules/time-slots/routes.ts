import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { resolveEditionId } from "../editions/controller";
import { ConflictError, createTimeSlot, deleteTimeSlot, listTimeSlots, NotFoundError, ValidationError } from "./controller";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

/** Public list of the base time slots of `?edition=<id>` (default: current), in chronological order. */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listTimeSlots(await resolveEditionId(req.query.edition)));
});

/** Body: { "startsAt": "2026-10-31T16:30:00.000Z", "editionId"?: 2 }. 409 if it already exists. */
router.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createTimeSlot(await resolveEditionId(req.body?.editionId), req.body ?? {}));
});

router.delete("/:id", ...canManage, async (req: Request, res: Response) => {
    await deleteTimeSlot(Number(req.params.id));
    res.status(204).end();
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError)
        return res.status(400).json({ message: err.message });
    if (err instanceof ConflictError)
        return res.status(409).json({ message: err.message });
    if (err instanceof NotFoundError)
        return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
