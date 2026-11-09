import express, { NextFunction, Request, Response, Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
    assertCanManageIdentity,
    assertCanManageMembers,
    ConflictError,
    ForbiddenError,
    getOrganizationHierarchy,
    getOrganizationPermissions,
    IdentityImage,
    setOrganizationImage,
    updateOrganizationIdentity,
    listOrganizationsHierarchy,
    NotFoundError,
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
    res.json(await getOrganizationPermissions(req.user!.email, id));
});

/** Text fields of the visual identity (name, description, gradient, accent color, about, links). */
router.put("/:id/identity", authMiddleware, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await assertCanManageIdentity(req.user!.email, id);
    res.json(await updateOrganizationIdentity(id, req.body ?? {}));
});

const UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads", "organizations");
const UPLOAD_URL_PREFIX = "/uploads/organizations/";
const IMAGE_EXTENSIONS: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
};

function parseImageKind(raw: unknown): IdentityImage {
    if (raw !== "logo" && raw !== "banner")
        throw new ValidationError("Image must be logo or banner");
    return raw;
}

/** Deletes a previously uploaded image; ignores static/default logos and missing files. */
async function deleteUpload(url: string | null) {
    if (!url?.startsWith(UPLOAD_URL_PREFIX))
        return;
    const fileName = path.basename(url);
    await fs.rm(path.join(UPLOAD_DIR, fileName), { force: true });
}

router.put(
    "/:id/images/:kind",
    authMiddleware,
    express.raw({ type: Object.keys(IMAGE_EXTENSIONS), limit: "5mb" }),
    async (req: Request, res: Response) => {
        const id = parseId(req.params.id);
        const kind = parseImageKind(req.params.kind);
        await assertCanManageIdentity(req.user!.email, id);

        const extension = IMAGE_EXTENSIONS[String(req.headers["content-type"] || "")];
        if (!extension)
            throw new ValidationError("Unsupported image type (png, jpeg, webp)");
        if (!Buffer.isBuffer(req.body) || req.body.length === 0)
            throw new ValidationError("Send an image body (png, jpeg, webp)");

        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const fileName = `${id}-${kind}-${Date.now()}.${extension}`;
        await fs.writeFile(path.join(UPLOAD_DIR, fileName), req.body);

        const { previous, organization } = await setOrganizationImage(id, kind, `${UPLOAD_URL_PREFIX}${fileName}`);
        await deleteUpload(previous);
        res.json(organization);
    },
);

router.delete("/:id/images/:kind", authMiddleware, async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const kind = parseImageKind(req.params.kind);
    await assertCanManageIdentity(req.user!.email, id);

    const { previous, organization } = await setOrganizationImage(id, kind, null);
    await deleteUpload(previous);
    res.json(organization);
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
    if (err instanceof ConflictError)
        return res.status(409).json({ message: err.message });
    if (err instanceof ForbiddenError)
        return res.status(403).json({ message: err.message });
    if (err instanceof NotFoundError)
        return res.status(404).json({ message: err.message });
    next(err);
});

export default router;
