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
    // Errors a module router did not translate (e.g. thrown by a shared helper of another module).
    else if (err.name === 'Validation Error') {
        res.status(400).json({ message: err.message })
    }
    else if (err.name === 'Not Found Error') {
        res.status(404).json({ message: err.message })
    }
    else if (err.name === 'Conflict Error') {
        res.status(409).json({ message: err.message })
    }
    else if (err.name === 'Forbidden Error') {
        res.status(403).json({ message: err.message })
    }
    else {
        res.sendStatus(500);
        throw err;
    }
}
