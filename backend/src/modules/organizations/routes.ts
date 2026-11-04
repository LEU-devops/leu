import { NextFunction, Request, Response, Router } from "express";
import { getOrganizationHierarchy, listOrganizationsHierarchy, NotFoundError } from "./controller";

const router = Router();

function parseId(raw: unknown): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0)
        throw new Error("id must be a positive integer");
    return id;
}

/** Public list of organizations and their members hierarchy. */
router.get("/", async (_req: Request, res: Response) => {
    res.json(await listOrganizationsHierarchy());
});

router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    res.json(await getOrganizationHierarchy(id));
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err.message === "id must be a positive integer")
        return res.status(400).json({ message: err.message });
    if (err instanceof NotFoundError)
        return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
