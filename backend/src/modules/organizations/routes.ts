import { NextFunction, Request, Response, Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
    assertCanManageMembers,
    canManageMembers,
    ForbiddenError,
    getOrganizationHierarchy,
    listOrganizationsHierarchy,
    NotFoundError,
    searchUsers,
    updateOrganizationMembers,
    ValidationError,
} from "./controller";

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

/** What the logged-in user can do in this organization. */
router.get("/:id/permissions", authMiddleware, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    res.json({ canManageMembers: await canManageMembers(req.user!.email, id) });
});

/** User search to add members; only for those who can manage this organization. */
router.get("/:id/user-search", authMiddleware, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await assertCanManageMembers(req.user!.email, id);
    res.json(await searchUsers(String(req.query.q ?? "")));
});

/** Batch of member changes: `{ add: [{ email, role, director_area }], remove: [email] }`. */
router.put("/:id/members", authMiddleware, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await assertCanManageMembers(req.user!.email, id);
    res.json(await updateOrganizationMembers(id, req.body ?? {}));
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err.message === "id must be a positive integer")
        return res.status(400).json({ message: err.message });
    if (err instanceof ValidationError)
        return res.status(400).json({ message: err.message });
    if (err instanceof ForbiddenError)
        return res.status(403).json({ message: err.message });
    if (err instanceof NotFoundError)
        return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
