import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { resolveEditionId } from "../editions/controller";
import {
    clearMatchResult,
    ConflictError,
    createBracket,
    createModality,
    deleteModality,
    getBracket,
    getEditionModality,
    listCatalog,
    listModalities,
    NotFoundError,
    setMatchResult,
    setMatchSchedule,
    ValidationError,
} from "./controller";
import { db } from "../../services/db";
import type { ModalityRef } from "../../types/competition";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

/** The modality of the URL in `?edition=<id>` (default: the current edition). */
async function modalityRef(req: Request): Promise<ModalityRef> {
    return { editionId: await resolveEditionId(req.query.edition), code: String(req.params.code).toUpperCase() };
}

/** Like `modalityRef`, but 404 when the edition does not have the modality. */
async function existingRef(req: Request): Promise<ModalityRef> {
    const ref = await modalityRef(req);
    await getEditionModality(db, ref);
    return ref;
}

// --- MODALITIES ---
/** Modalities of `?edition=<id>` (default: the current edition). */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listModalities(await resolveEditionId(req.query.edition)));
});

/** Every modality of every edition, each with `edition_ids` (the editions that have it). */
router.get("/catalog", async (_req: Request, res: Response) => {
    res.json(await listCatalog());
});

/** Body: `{ code, name, type, editionIds?: number[] }`: a new catalog modality, added to those editions. */
router.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createModality(req.body ?? {}));
});

/** Removes the modality from the catalog; only when nothing was played in it in any edition. */
router.delete("/:code", ...canManage, async (req: Request, res: Response) => {
    await deleteModality(String(req.params.code).toUpperCase());
    res.sendStatus(204);
});

/** The modality as played in `?edition=` (404 when the edition does not have it). */
router.get("/:code", async (req: Request, res: Response) => {
    res.json(await getEditionModality(db, await modalityRef(req)));
});

// --- BRACKET (all routes below take `?edition=`, default: the current edition) ---
router.get("/:code/bracket", async (req: Request, res: Response) => {
    res.json(await getBracket(await existingRef(req)));
});

/**
 * Body: { "slots": ["Time 1", "Time 2", null, "Time 3", ...] }
 * First-round slots top to bottom (length 2, 4, 8 or 16); null marks a bye for the slot's opponent.
 */
router.post("/:code/bracket", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createBracket(await modalityRef(req), req.body?.slots));
});

// --- RESULTS ---

/**
 * Body: { "scoreA": "2", "scoreB": "2 (4)", "winner": "a" | "b", "walkover": false }.
 * `walkover` is optional (default false); set it to true when the winner won by WO. Responds with the whole bracket.
 */
router.put("/:code/matches/:id/result", ...canManage, async (req: Request, res: Response) => {
    res.json(await setMatchResult(await existingRef(req), Number(req.params.id), req.body ?? {}));
});

/** Reverts a match to unresolved. Responds with the whole bracket. */
router.delete("/:code/matches/:id/result", ...canManage, async (req: Request, res: Response) => {
    res.json(await clearMatchResult(await existingRef(req), Number(req.params.id)));
});

// --- SCHEDULE ---

/**
 * Body: { "scheduledAt": "2026-11-07T17:00:00.000Z" | null, "venueId": 3 | null, "redatorTeamId": 5 | null, "mesarioTeamId": 5 | null }.
 * Responds with the whole bracket.
 */
router.put("/:code/matches/:id/schedule", ...canManage, async (req: Request, res: Response) => {
    res.json(await setMatchSchedule(await existingRef(req), Number(req.params.id), req.body ?? {}));
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
