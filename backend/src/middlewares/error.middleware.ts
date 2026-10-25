import { Response, NextFunction, Request } from "express";

// TODO: Log to a file

export function errorMiddleware(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (err.name === 'Permission Error') {
        res.status(401).send({ error: err.message })
    }
    else {
        res.sendStatus(500);
        throw err;
    }
}
