import express, { NextFunction, Request, Response, Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { signToken } from "../../utils/jwt";
import {
  ConflictError,
  getProfile,
  getUserPayload,
  registerUser,
  updateProfile,
  updateProfilePhoto,
  validateUserAuth,
  ValidationError,
} from "./controller";

const router = Router();

// --- LOGIN ---
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!(await validateUserAuth(email, password))) return res.sendStatus(401);

  return res.json({
    token: signToken(await getUserPayload(email)),
  });
});

// --- REGISTER --- This route is primarily only for internal use, it will not be consumed by the frontend
router.post("/register", async (req: Request, res: Response) => {
  await registerUser(req.body);

  return res.json({
    token: signToken(await getUserPayload(req.body.email)),
  });
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  res.json(await getProfile(req.user!.email));
});

router.put("/me", authMiddleware, async (req: Request, res: Response) => {
  res.json(await updateProfile(req.user!.email, req.body ?? {}));
});

router.put(
  "/me/photo",
  authMiddleware,
  express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: "5mb",
  }),
  async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
      throw new ValidationError("Send an image body (png, jpeg, webp)");

    const contentType = String(req.headers["content-type"] || "");
    const extension =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : contentType === "image/jpeg"
            ? "jpg"
            : null;

    if (!extension) throw new ValidationError("Unsupported image type");

    const baseDir = path.resolve(
      process.cwd(),
      "public",
      "uploads",
      "profiles",
    );
    await fs.mkdir(baseDir, { recursive: true });

    const safeEmail = req.user!.email.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${safeEmail}-${Date.now()}.${extension}`;
    const destination = path.join(baseDir, fileName);

    await fs.writeFile(destination, req.body);
    const profileUrl = `/uploads/profiles/${fileName}`;
    res.json(await updateProfilePhoto(req.user!.email, profileUrl));
  },
);

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ValidationError)
    return res.status(400).json({ message: err.message });
  if (err instanceof ConflictError)
    return res.status(409).json({ message: err.message });
  next(err);
});

export default router;
