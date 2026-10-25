import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { ConflictError, createVenue, listVenues, ValidationError } from "./controller";

const router = Router();

const canManage = [authMiddleware, requirePermission("criar-chaveamento")];

/** Public list of venues with their full path ("FEF > Complexo de Vôlei > Q1"). */
router.get("/", async (_req: Request, res: Response) => {
    res.json(await listVenues());
});

/** Body: { "name": "Q1", "parentId": 3 } (parentId null or omitted for a root venue). */
router.post("/", ...canManage, async (req: Request, res: Response) => {
    res.status(201).json(await createVenue(req.body ?? {}));
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError)
        return res.status(400).json({ message: err.message });
    if (err instanceof ConflictError)
        return res.status(409).json({ message: err.message });
    next(err);
});

export default router;
