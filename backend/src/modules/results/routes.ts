import { Request, Response, Router } from "express";
import { ValidationError } from "../editions/controller";
import { listChampions } from "./controller";

const router = Router();

/** Public: podiums of every edition with saved results, newest first. `?cup_id=` narrows the cup, `?modality=FM` picks a modality (default: overall). */
router.get("/", async (req: Request, res: Response) => {
    const cupId = req.query.cup_id === undefined || req.query.cup_id === "" ? undefined : Number(req.query.cup_id);
    if (cupId !== undefined && (!Number.isInteger(cupId) || cupId <= 0)) throw new ValidationError("cup_id must be a positive integer");
    const modality = typeof req.query.modality === "string" && req.query.modality !== "" ? req.query.modality : undefined;
    res.json(await listChampions({ cupId, modality }));
});

export default router;
