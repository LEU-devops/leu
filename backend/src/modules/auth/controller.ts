import { db } from "../../services/db";
import { User, UserPayload } from "../../types/users";
import { hashPassword, verifyPassword } from "../../utils/passwords";

export interface RegisterUserInput {
  email: string;
  password: string;
  nickname: string;
  fullName?: string | null;
  ra?: string | null;
  cpf?: string | null;
}

export interface UpdateProfileInput {
  nickname?: unknown;
  fullName?: unknown;
  ra?: unknown;
  cpf?: unknown;
}

export class ValidationError extends Error {
  name = "Validation Error";
}

export class ConflictError extends Error {
  name = "Conflict Error";
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string")
    throw new ValidationError("Field must be a string");
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRa(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (text === null) return null;
  const digits = onlyDigits(text);
  if (!/^\d{6}$/.test(digits))
    throw new ValidationError("RA must have exactly 6 digits");
  return digits;
}

function normalizeCpf(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (text === null) return null;
  const digits = onlyDigits(text);
  if (!/^\d{11}$/.test(digits))
    throw new ValidationError("CPF must have exactly 11 digits");
  return digits;
}

function normalizeNickname(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new ValidationError("nickname is required");
  return value.trim();
}

export async function registerUser({
  email,
  password,
  nickname,
  fullName,
  ra,
  cpf,
}: RegisterUserInput) {
  const passwordHash = await hashPassword(password);

  await db("users").insert({
    email,
    password: passwordHash,
    nickname: normalizeNickname(nickname),
    full_name: normalizeOptionalText(fullName),
    ra: normalizeRa(ra),
    cpf: normalizeCpf(cpf),
    profile_photo_url: null,
  });
}

export async function getUserPayload(email: string): Promise<UserPayload> {
  const user = await db("users")
    .select("email", "nickname", "full_name", "profile_photo_url")
    .where({ email })
    .first();

  if (!user) throw new Error(`User with email ${email} not found`);

  return {
    email: user.email,
    nickname: user.nickname,
    full_name: user.full_name,
    profile_photo_url: user.profile_photo_url,
  };
}

export async function validateUserAuth(email: string, password: string) {
  const user = await db("users").select("password").where({ email }).first();

  if (!user) return false;

  return await verifyPassword(password, user.password);
}

export async function getProfile(
  email: string,
): Promise<UserPayload & { ra: string | null; cpf: string | null }> {
  const user = await db("users")
    .select("email", "nickname", "full_name", "ra", "cpf", "profile_photo_url")
    .where({ email })
    .first();

  if (!user) throw new Error(`User with email ${email} not found`);

  return {
    email: user.email,
    nickname: user.nickname,
    full_name: user.full_name,
    ra: user.ra,
    cpf: user.cpf,
    profile_photo_url: user.profile_photo_url,
  };
}

export async function updateProfile(
  email: string,
  input: UpdateProfileInput,
): Promise<UserPayload & { ra: string | null; cpf: string | null }> {
  const changes: Record<string, string | null> = {};

  if (input.nickname !== undefined)
    changes.nickname = normalizeNickname(input.nickname);

  if (input.fullName !== undefined)
    changes.full_name = normalizeOptionalText(input.fullName);

  if (input.ra !== undefined) changes.ra = normalizeRa(input.ra);

  if (input.cpf !== undefined) changes.cpf = normalizeCpf(input.cpf);

  if (Object.keys(changes).length === 0)
    throw new ValidationError("Provide at least one field to update");

  try {
    await db("users").where({ email }).update(changes);
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed: users\.(ra|cpf)/.test(error.message)
    )
      throw new ConflictError("RA or CPF already used by another user");
    throw error;
  }

  return getProfile(email);
}

export async function updateProfilePhoto(
  email: string,
  photoUrl: string,
): Promise<UserPayload & { ra: string | null; cpf: string | null }> {
  await db("users").where({ email }).update({ profile_photo_url: photoUrl });
  return getProfile(email);
}
