import { Request, Response, Router } from "express";
import { resolveEditionId } from "../editions/controller";
import { listMatches } from "./controller";

const router = Router();

/** Public list of every match across the modalities of `?edition=<id>` (default: current), used by the schedule table. */
router.get("/", async (req: Request, res: Response) => {
    res.json(await listMatches(await resolveEditionId(req.query.edition)));
});

export default router;
