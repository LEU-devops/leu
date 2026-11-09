import { Request, Response, Router } from "express";
import { resolveEditionId } from "../editions/controller";
import { getStandings } from "./controller";

const router = Router();

/**
 * Public standings table: rows are teams, columns are modalities, each cell holds the team's
 * position and points (as ranges while the bracket is in progress), plus bonus, penalty and totals.
 */
router.get("/", async (req: Request, res: Response) => {
    res.json(await getStandings(await resolveEditionId(req.query.edition)));
});

export default router;
