import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { resolveEditionId } from "../editions/controller";
import { ForbiddenError, NotFoundError, ValidationError } from "../organizations/controller";
import {
    addParticipationAward,
    createExternalParticipation,
    deleteParticipation,
    deleteParticipationAward,
    getParticipation,
    listCopaEntries,
    listParticipations,
    setCopaAthletes,
    updateParticipation,
} from "./controller";

const router = Router();

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0)
        throw new ValidationError("id must be a positive integer");
    return id;
}

/** Public: participations of `?team_id=` (a sports team) or of `?email=` (an athlete). */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listParticipations({
        teamId: req.query.team_id === undefined ? undefined : parseId(req.query.team_id),
        email: req.query.email === undefined ? undefined : String(req.query.email),
    }));
});

/** Public: the Copa modalities of `?organization_id=` in `?edition=` (default: current), with live results. */
router.get("/copa", async (req: Request, res: Response) => {
    res.json(await listCopaEntries(parseId(req.query.organization_id), await resolveEditionId(req.query.edition)));
});

/** Body: `{ edition_id?, modality_code, organization_id, athletes: [email] }` (default: the current edition). Creates the Copa participation on first save. */
router.put("/copa", authMiddleware, async (req: Request, res: Response) => {
    res.json(await setCopaAthletes(req.user!.email, await resolveEditionId(req.body?.edition_id), req.body ?? {}));
});

router.get("/:id", async (req: Request, res: Response) => {
    res.json(await getParticipation(parseId(req.params.id)));
});

/** Body: `{ sports_team_id, competition, year, placement: 1 | 2 | 3 | 4... | null, athletes: [email] }`. */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    res.status(201).json(await createExternalParticipation(req.user!.email, req.body ?? {}));
});

/** Body: any of `{ competition, year, placement, athletes }` (Copa: athletes only). */
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
    res.json(await updateParticipation(req.user!.email, parseId(req.params.id), req.body ?? {}));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
    await deleteParticipation(req.user!.email, parseId(req.params.id));
    res.sendStatus(204);
});

/** Body: `{ title, recipients: [email] }` (athletes of the participation). */
router.post("/:id/awards", authMiddleware, async (req: Request, res: Response) => {
    res.status(201).json(await addParticipationAward(req.user!.email, parseId(req.params.id), req.body ?? {}));
});

router.delete("/:id/awards/:awardId", authMiddleware, async (req: Request, res: Response) => {
    res.json(await deleteParticipationAward(req.user!.email, parseId(req.params.id), parseId(req.params.awardId)));
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
    if (err instanceof ForbiddenError) return res.status(403).json({ message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
