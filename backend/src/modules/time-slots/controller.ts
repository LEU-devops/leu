import { db } from "../../services/db";
import type { TimeSlot } from "../../types/competition";

export class ValidationError extends Error {
    name = "Validation Error";
}

export class ConflictError extends Error {
    name = "Conflict Error";
}

export class NotFoundError extends Error {
    name = "Not Found Error";
}

/** Base time slots of an edition in chronological order. */
export async function listTimeSlots(editionId: number): Promise<TimeSlot[]> {
    return db("time_slots").where({ edition_id: editionId }).select("*").orderBy("starts_at");
}

/** Body: { "startsAt": "2026-10-31T16:30:00.000Z" }. The time is normalized to ISO UTC before storing. */
export async function createTimeSlot(editionId: number, input: { startsAt?: unknown }): Promise<TimeSlot> {
    const date = typeof input.startsAt === "string" ? new Date(input.startsAt) : new Date(NaN);
    if (Number.isNaN(date.getTime()))
        throw new ValidationError("startsAt must be an ISO 8601 date string");
    const startsAt = date.toISOString();

    if (await db("time_slots").where({ starts_at: startsAt }).first())
        throw new ConflictError("This time slot already exists");

    const [{ id }] = await db("time_slots").insert({ starts_at: startsAt, edition_id: editionId }).returning("id");
    return { id, starts_at: startsAt, edition_id: editionId };
}

export async function deleteTimeSlot(id: number): Promise<void> {
    if (!Number.isInteger(id))
        throw new ValidationError("id must be an integer");
    const deleted = await db("time_slots").where({ id }).delete();
    if (deleted === 0)
        throw new NotFoundError(`Time slot ${id} not found`);
}
