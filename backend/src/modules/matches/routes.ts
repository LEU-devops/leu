import { Request, Response, Router } from "express";
import { listMatches } from "./controller";

const router = Router();

/** Public list of every match across modalities, used by the schedule table. */
router.get("/", async (_req: Request, res: Response) => {
    res.json(await listMatches());
});

export default router;
