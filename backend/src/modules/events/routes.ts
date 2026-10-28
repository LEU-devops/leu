import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
    ConflictError,
    createEvent,
    deleteEvent,
    getEventsView,
    NotFoundError,
    setEventResults,
    setRegistrations,
    updateEvent,
    ValidationError,
} from "./controller";

/**
 * Events modalities (atletismo, natação), mounted next to the modalities router under /modalities.
 * Every mutation responds with the whole events view of the modality.
 */
const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

function code(req: Request): string {
    return String(req.params.code).toUpperCase();
}

function eventId(req: Request): number {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        throw new ValidationError("event id must be a positive integer");
    return id;
}

/** Public: registered teams, events with results, and the internal standings of the modality. */
router.get("/:code/events", async (req: Request, res: Response) => {
    res.json(await getEventsView(code(req)));
});

/** Body: { "teamIds": [1, 2, 3] }. Replaces the registered teams; a team with results cannot be removed. */
router.put("/:code/registrations", ...canManage, async (req: Request, res: Response) => {
    res.json(await setRegistrations(code(req), req.body ?? {}));
});

/** Body: { "name": "100m rasos", "kind": "normal" | "demonstrativa" | "revezamento" } (kind defaults to normal). */
router.post("/:code/events", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createEvent(code(req), req.body ?? {}));
});

/** Body: { "name"?, "kind"?, "finished"? }. Fields left out keep their value. */
router.put("/:code/events/:id", ...canManage, async (req: Request, res: Response) => {
    res.json(await updateEvent(code(req), eventId(req), req.body ?? {}));
});

/** Deletes the event and its results. */
router.delete("/:code/events/:id", ...canManage, async (req: Request, res: Response) => {
    res.json(await deleteEvent(code(req), eventId(req)));
});

/** Body: { "positions": [teamId | null, ...] }, index 0 = first place. Replaces every result of the event. */
router.put("/:code/events/:id/results", ...canManage, async (req: Request, res: Response) => {
    res.json(await setEventResults(code(req), eventId(req), req.body ?? {}));
});

// Translate the controller errors of this module into HTTP statuses.
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
