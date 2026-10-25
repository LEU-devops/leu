import { Request, Response, Router } from "express";
import { db } from "../../services/db";

const router = Router();

/** Public list of every team, used to fill the bracket builder. */
router.get("/", async (_req: Request, res: Response) => {
    res.json(await db("teams").select("*").orderBy("name"));
});

export default router;
