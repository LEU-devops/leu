import { UserPayload } from "./users";

declare module 'express' {
    interface Request {
        user?: UserPayload;
    }
}

export { }