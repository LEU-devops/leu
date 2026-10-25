import { Request, Response, Router } from "express";
import { signToken } from "../../utils/jwt";
import { getUserPayload, registerUser, validateUserAuth } from "./controller";

const router = Router();

// --- LOGIN ---
router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!await validateUserAuth(email, password))
        return res.sendStatus(401);

    return res.json({
        token: signToken(await getUserPayload(email))
    })
});

// --- REGISTER --- This route is primarily only for internal use, it will not be consumed by the frontend
router.post("/register", async (req: Request, res: Response) => {
    await registerUser(req.body)

    return res.json({
        token: signToken(await getUserPayload(req.body.email))
    });
});


export default router