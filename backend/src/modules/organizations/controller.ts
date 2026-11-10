import { db } from "../../services/db";
import { isIsoDate, today } from "../../utils/dates";
import type { Knex } from "knex";

export type OrganizationRole =
  | "aluno"
  | "membro"
  | "conselheiro"
  | "diretor"
  | "presidente"
  | "vice";

export interface OrganizationMember {
  email: string;
  name: string;
  profile_photo_url: string | null;
  role: OrganizationRole;
  director_area: string | null;
}

/** Visual identity and public info of an organization (everything but its members). */
export interface OrganizationIdentity {
  id: number;
  name: string;
  /** Abbreviation shown in the Copas by default ("FEA"). */
  short_name: string | null;
  description: string | null;
  gradient: string;
  logo_url: string | null;
  banner_url: string | null;
  accent_color: string | null;
  about: string | null;
  instagram: string | null;
  website: string | null;
  contact_email: string | null;
  store_url: string | null;
}

export interface OrganizationHierarchy extends OrganizationIdentity {
  members: OrganizationMember[];
}

const IDENTITY_COLUMNS = [
  "id",
  "name",
  "short_name",
  "description",
  "gradient",
  "logo_url",
  "banner_url",
  "accent_color",
  "about",
  "instagram",
  "website",
  "contact_email",
  "store_url",
] as const;

export class NotFoundError extends Error {
  name = "Not Found Error";
}

export class ValidationError extends Error {
  name = "Validation Error";
}

export class ForbiddenError extends Error {
  name = "Forbidden Error";
}

export class ConflictError extends Error {
  name = "Conflict Error";
}

export const ORGANIZATION_ROLES: OrganizationRole[] = [
  "presidente",
  "vice",
  "diretor",
  "conselheiro",
  "membro",
  "aluno",
];

const LEU_NAME = "LEU";

type Position = { role: string; director_area: string | null };

function isDirectorOf(position: Position, area: string): boolean {
  return (
    position.role === "diretor" &&
    (position.director_area ?? "").trim().toLowerCase() === area
  );
}

/** Presidents and secretaries (diretores da Secretaria) manage members. */
function isMemberManager(position: Position): boolean {
  return position.role === "presidente" || isDirectorOf(position, "secretaria");
}

/** Presidents and marketing directors manage the visual identity. */
function isIdentityManager(position: Position): boolean {
  return position.role === "presidente" || isDirectorOf(position, "marketing");
}

/** Presidents and sports directors manage teams, DMs and awards. */
function isSportsManager(position: Position): boolean {
  return position.role === "presidente" || isDirectorOf(position, "esportes");
}

/** Positions of `email` in organization `organizationId` and in the LEU (which manages all). */
async function relevantPositions(
  email: string,
  organizationId: number,
): Promise<Position[]> {
  return db("organization_positions as ou")
    .join("organizations as o", "o.id", "ou.organization_id")
    .where("ou.user_email", email)
    .whereNull("ou.ended_on")
    .andWhere((query) =>
      query
        .where("ou.organization_id", organizationId)
        .orWhere("o.name", LEU_NAME),
    )
    .select<Position[]>("ou.role", "ou.director_area");
}

export interface OrganizationPermissions {
  canManageMembers: boolean;
  canManageIdentity: boolean;
  /** Teams, rosters, DMs and awards of the organization. */
  canManageSports: boolean;
}

export async function getOrganizationPermissions(
  email: string,
  organizationId: number,
): Promise<OrganizationPermissions> {
  const positions = await relevantPositions(email, organizationId);
  return {
    canManageMembers: positions.some(isMemberManager),
    canManageIdentity: positions.some(isIdentityManager),
    canManageSports: positions.some(isSportsManager),
  };
}

export async function assertCanManageSports(
  email: string,
  organizationId: number,
): Promise<void> {
  await assertOrganizationExists(organizationId);
  if (!(await getOrganizationPermissions(email, organizationId)).canManageSports)
    throw new ForbiddenError("Only presidents and sports directors can manage teams and awards");
}

async function assertOrganizationExists(organizationId: number): Promise<void> {
  const exists = await db("organizations").where({ id: organizationId }).first();
  if (!exists) throw new NotFoundError(`Organization ${organizationId} not found`);
}

export async function assertCanManageMembers(
  email: string,
  organizationId: number,
): Promise<void> {
  await assertOrganizationExists(organizationId);
  if (!(await getOrganizationPermissions(email, organizationId)).canManageMembers)
    throw new ForbiddenError("Only presidents and secretaries can manage members");
}

export async function assertCanManageIdentity(
  email: string,
  organizationId: number,
): Promise<void> {
  await assertOrganizationExists(organizationId);
  if (!(await getOrganizationPermissions(email, organizationId)).canManageIdentity)
    throw new ForbiddenError("Only presidents and marketing directors can manage the visual identity");
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
/** Only the shape the identity editor produces, since it is injected into inline styles. */
const GRADIENT = /^linear-gradient\(\d{1,3}deg, #[0-9a-f]{6} \d{1,3}%, #[0-9a-f]{6} \d{1,3}%\)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/i;

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength)
    throw new ValidationError(`${field} must have at most ${maxLength} characters`);
  return trimmed.length > 0 ? trimmed : null;
}

function optionalUrl(value: unknown, field: string): string | null {
  const text = optionalText(value, field, 500);
  if (text === null) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) throw new Error();
    return url.toString();
  } catch {
    throw new ValidationError(`${field} must be a valid URL`);
  }
}

/** Accepts "@handle", "handle" or an instagram.com URL; stores the bare handle. */
function instagramHandle(value: unknown): string | null {
  const text = optionalText(value, "instagram", 200);
  if (text === null) return null;
  const fromUrl = text.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  const handle = (fromUrl ?? text).replace(/^@/, "");
  if (!INSTAGRAM_HANDLE.test(handle))
    throw new ValidationError("instagram must be a valid handle");
  return handle;
}

export type IdentityInput = Partial<Record<keyof OrganizationIdentity, unknown>>;

/** Updates the text fields of the identity. Only the fields present in `input` change. */
export async function updateOrganizationIdentity(
  organizationId: number,
  input: IdentityInput,
): Promise<OrganizationHierarchy> {
  const current = await db("organizations").where({ id: organizationId }).first();
  if (!current) throw new NotFoundError(`Organization ${organizationId} not found`);

  const changes: Partial<OrganizationIdentity> = {};

  if (input.name !== undefined) {
    const name = optionalText(input.name, "name", 30);
    if (name === null) throw new ValidationError("name is required");
    if (name !== current.name && current.name === LEU_NAME)
      throw new ValidationError("The LEU name cannot be changed");
    changes.name = name;
  }
  if (input.short_name !== undefined) {
    const shortName = optionalText(input.short_name, "short_name", 12);
    changes.short_name = shortName?.toUpperCase() ?? null;
  }
  if (input.description !== undefined)
    changes.description = optionalText(input.description, "description", 200);
  if (input.about !== undefined)
    changes.about = optionalText(input.about, "about", 2000);
  if (input.gradient !== undefined) {
    if (typeof input.gradient !== "string" || !GRADIENT.test(input.gradient.trim()))
      throw new ValidationError("Invalid gradient");
    changes.gradient = input.gradient.trim();
  }
  if (input.accent_color !== undefined) {
    const color = optionalText(input.accent_color, "accent_color", 7);
    if (color !== null && !HEX_COLOR.test(color))
      throw new ValidationError("accent_color must be a #RRGGBB color");
    changes.accent_color = color?.toLowerCase() ?? null;
  }
  if (input.instagram !== undefined) changes.instagram = instagramHandle(input.instagram);
  if (input.website !== undefined) changes.website = optionalUrl(input.website, "website");
  if (input.store_url !== undefined) changes.store_url = optionalUrl(input.store_url, "store_url");
  if (input.contact_email !== undefined) {
    const email = optionalText(input.contact_email, "contact_email", 200);
    if (email !== null && !EMAIL.test(email))
      throw new ValidationError("contact_email must be a valid e-mail");
    changes.contact_email = email;
  }

  if (Object.keys(changes).length === 0)
    throw new ValidationError("Nothing to change");

  if (changes.name && changes.name !== current.name) {
    const taken = await db("organizations")
      .whereRaw("LOWER(name) = ?", [changes.name.toLowerCase()])
      .whereNot({ id: organizationId })
      .first();
    if (taken) throw new ConflictError("Another organization already uses this name");
  }

  await db("organizations").where({ id: organizationId }).update(changes);
  return getOrganizationHierarchy(organizationId);
}

export type IdentityImage = "logo" | "banner";

/** Sets (or clears, with null) the logo or banner URL; returns the previous URL. */
export async function setOrganizationImage(
  organizationId: number,
  kind: IdentityImage,
  url: string | null,
): Promise<{ previous: string | null; organization: OrganizationHierarchy }> {
  const column = kind === "logo" ? "logo_url" : "banner_url";
  const current = await db("organizations").where({ id: organizationId }).first();
  if (!current) throw new NotFoundError(`Organization ${organizationId} not found`);

  await db("organizations").where({ id: organizationId }).update({ [column]: url });
  return {
    previous: current[column],
    organization: await getOrganizationHierarchy(organizationId),
  };
}

export interface UserSearchResult {
  email: string;
  name: string;
  full_name: string | null;
  profile_photo_url: string | null;
}

/** Users matching `query` by nickname, full name or email (case-insensitive). */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const rows = await db("users")
    .select("email", "nickname", "full_name", "profile_photo_url")
    .whereRaw("LOWER(nickname) LIKE ? ESCAPE '\\'", [like])
    .orWhereRaw("LOWER(COALESCE(full_name, '')) LIKE ? ESCAPE '\\'", [like])
    .orWhereRaw("LOWER(email) LIKE ? ESCAPE '\\'", [like])
    .orderBy("nickname", "asc")
    .limit(10);

  return rows.map((row) => ({
    email: row.email,
    name: row.nickname,
    full_name: row.full_name,
    profile_photo_url: row.profile_photo_url,
  }));
}

export interface MemberAddition {
  email: string;
  role: OrganizationRole;
  director_area: string | null;
}

export interface MembersChangeInput {
  add?: unknown;
  remove?: unknown;
}

function parseAdditions(raw: unknown): MemberAddition[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new ValidationError("add must be an array");

  return raw.map((item) => {
    if (typeof item !== "object" || item === null)
      throw new ValidationError("Each addition must be an object");
    const { email, role, director_area } = item as Record<string, unknown>;

    if (typeof email !== "string" || email.trim().length === 0)
      throw new ValidationError("Each addition needs an email");
    if (typeof role !== "string" || !ORGANIZATION_ROLES.includes(role as OrganizationRole))
      throw new ValidationError(`Invalid role: ${String(role)}`);

    let area: string | null = null;
    if (role === "diretor") {
      if (typeof director_area !== "string" || director_area.trim().length === 0)
        throw new ValidationError("Directors need a director_area");
      area = director_area.trim();
    }

    return { email: email.trim(), role: role as OrganizationRole, director_area: area };
  });
}

function parseRemovals(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((email) => typeof email !== "string"))
    throw new ValidationError("remove must be an array of emails");
  return raw.map((email: string) => email.trim());
}

/**
 * Ends the given open periods today. A period that also started today is deleted instead,
 * so undoing a change on the same day leaves no zero-length entry in the history.
 */
export async function closePeriods(
  trx: Knex.Transaction,
  openPeriods: Knex.QueryBuilder,
): Promise<void> {
  const day = today();
  await openPeriods.clone().where("started_on", day).delete();
  await openPeriods.clone().update({ ended_on: day });
}

/**
 * Applies removals, then additions, atomically. Removing ends the person's current period;
 * adding opens a new one today. Removing and re-adding the same
 * email in one call changes that member's role.
 */
export async function updateOrganizationMembers(
  organizationId: number,
  input: MembersChangeInput,
): Promise<OrganizationHierarchy> {
  const additions = parseAdditions(input.add);
  const removals = parseRemovals(input.remove);

  if (additions.length === 0 && removals.length === 0)
    throw new ValidationError("Nothing to change");

  const addedEmails = additions.map((addition) => addition.email);
  if (new Set(addedEmails).size !== addedEmails.length)
    throw new ValidationError("The same user cannot be added twice");

  await db.transaction(async (trx) => {
    if (removals.length > 0) {
      const current = trx("organization_positions")
        .where({ organization_id: organizationId })
        .whereIn("user_email", removals)
        .whereNull("ended_on");
      const existing = await current.clone().select("user_email");
      if (existing.length !== new Set(removals).size)
        throw new ValidationError("Some removed users are not members");

      await closePeriods(trx, current);
    }

    if (additions.length > 0) {
      const users = await trx("users").whereIn("email", addedEmails).select("email");
      if (users.length !== addedEmails.length)
        throw new ValidationError("Some added users do not exist");

      const alreadyMembers = await trx("organization_positions")
        .where({ organization_id: organizationId })
        .whereIn("user_email", addedEmails)
        .whereNull("ended_on")
        .select("user_email");
      if (alreadyMembers.length > 0)
        throw new ValidationError(
          `Already a member: ${alreadyMembers.map((row) => row.user_email).join(", ")}`,
        );

      for (const addition of additions) {
        // Undoing a removal made today reopens that period instead of starting a new one.
        const endedToday = await trx("organization_positions")
          .where({ organization_id: organizationId, user_email: addition.email, role: addition.role, ended_on: today() })
          .andWhere((query) => addition.director_area === null
            ? query.whereNull("director_area")
            : query.where("director_area", addition.director_area))
          .first();
        if (endedToday)
          await trx("organization_positions").where({ id: endedToday.id }).update({ ended_on: null });
        else
          await trx("organization_positions").insert({
            organization_id: organizationId,
            user_email: addition.email,
            role: addition.role,
            director_area: addition.director_area,
            started_on: today(),
            ended_on: null,
          });
      }
    }
  });

  return getOrganizationHierarchy(organizationId);
}

interface OrganizationMemberRow {
  organization_id: number;
  user_email: string;
  user_name: string | null;
  profile_photo_url: string | null;
  role: OrganizationRole;
  director_area: string | null;
}

const ROLE_PRIORITY: Record<OrganizationRole, number> = {
  presidente: 0,
  vice: 1,
  diretor: 2,
  conselheiro: 3,
  membro: 4,
  aluno: 5,
};

/** Public hierarchy of every organization with members ordered by role priority. */
export async function listOrganizationsHierarchy(): Promise<
  OrganizationHierarchy[]
> {
  const organizations = await db("organizations")
    .select<OrganizationIdentity[]>(...IDENTITY_COLUMNS)
    .orderByRaw("CASE WHEN name = ? THEN 0 ELSE 1 END", [LEU_NAME])
    .orderBy("name", "asc");

  const members = await db("organization_positions as ou")
    .leftJoin("users as u", "u.email", "ou.user_email")
    .whereNull("ou.ended_on")
    .select<
      OrganizationMemberRow[]
    >("ou.organization_id", "ou.user_email", "u.nickname as user_name", "u.profile_photo_url", "ou.role", "ou.director_area");

  const grouped = new Map<number, OrganizationMember[]>();

  for (const member of members) {
    const list = grouped.get(member.organization_id) ?? [];
    list.push({
      email: member.user_email,
      name: member.user_name ?? member.user_email,
      profile_photo_url: member.profile_photo_url,
      role: member.role,
      director_area: member.director_area,
    });
    grouped.set(member.organization_id, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => {
      const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
      if (roleDiff !== 0) return roleDiff;

      const areaA = a.director_area ?? "";
      const areaB = b.director_area ?? "";
      const areaDiff = areaA.localeCompare(areaB, "pt-BR");
      if (areaDiff !== 0) return areaDiff;

      return a.name.localeCompare(b.name, "pt-BR");
    });
  }

  return organizations.map((organization) => ({
    ...organization,
    members: grouped.get(organization.id) ?? [],
  }));
}

/** Public hierarchy of one organization by id. */
export async function getOrganizationHierarchy(
  id: number,
): Promise<OrganizationHierarchy> {
  const organizations = await listOrganizationsHierarchy();
  const organization = organizations.find((row) => row.id === id);
  if (!organization) throw new NotFoundError(`Organization ${id} not found`);
  return organization;
}

/** Just enough of an organization to show its name, logo and colors next to a team. */
export interface OrganizationSummary {
  id: number;
  name: string;
  logo_url: string | null;
  gradient: string;
  accent_color: string | null;
}

export async function organizationSummaries(ids: number[]): Promise<Map<number, OrganizationSummary>> {
  if (ids.length === 0) return new Map();
  const rows = await db("organizations")
    .whereIn("id", [...new Set(ids)])
    .select<OrganizationSummary[]>("id", "name", "logo_url", "gradient", "accent_color");
  return new Map(rows.map((row) => [row.id, row]));
}

// --- POSITION HISTORY ---

export interface Period {
  started_on: string;
  ended_on: string | null;
}

/**
 * Validates `{ started_on, ended_on }`: real dates, not in the future, start before end.
 * `ended_on: null` (or missing) means the period is current.
 */
export function parsePeriod(input: { started_on?: unknown; ended_on?: unknown }): Period {
  if (!isIsoDate(input.started_on))
    throw new ValidationError("started_on must be a date (YYYY-MM-DD)");
  const ended = input.ended_on === undefined || input.ended_on === null || input.ended_on === "" ? null : input.ended_on;
  if (ended !== null && !isIsoDate(ended))
    throw new ValidationError("ended_on must be a date (YYYY-MM-DD) or null");

  const day = today();
  if (input.started_on > day || (ended !== null && ended > day))
    throw new ValidationError("Dates cannot be in the future");
  if (ended !== null && ended < input.started_on)
    throw new ValidationError("ended_on must be on or after started_on");
  return { started_on: input.started_on, ended_on: ended };
}

/** Postgres and SQLite word unique violations differently; both mean "already has a current period". */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /UNIQUE constraint failed|duplicate key value/.test(error.message);
}

export interface PositionView extends Period {
  id: number;
  email: string;
  name: string;
  profile_photo_url: string | null;
  role: OrganizationRole;
  director_area: string | null;
}

/** Every period of every person in the organization: current ones first, then the most recent. */
export async function listOrganizationPositions(organizationId: number): Promise<PositionView[]> {
  await assertOrganizationExists(organizationId);
  const rows = await db("organization_positions as p")
    .join("users as u", "u.email", "p.user_email")
    .where("p.organization_id", organizationId)
    .orderByRaw("CASE WHEN p.ended_on IS NULL THEN 0 ELSE 1 END")
    .orderBy("p.ended_on", "desc")
    .orderBy("p.started_on", "desc")
    .select<PositionView[]>(
      "p.id", "p.user_email as email", "u.nickname as name", "u.profile_photo_url",
      "p.role", "p.director_area", "p.started_on", "p.ended_on",
    );
  return rows;
}

function parseRoleAndArea(input: { role?: unknown; director_area?: unknown }) {
  if (typeof input.role !== "string" || !ORGANIZATION_ROLES.includes(input.role as OrganizationRole))
    throw new ValidationError(`Invalid role: ${String(input.role)}`);
  let area: string | null = null;
  if (input.role === "diretor") {
    if (typeof input.director_area !== "string" || input.director_area.trim().length === 0)
      throw new ValidationError("Directors need a director_area");
    area = input.director_area.trim();
  }
  return { role: input.role as OrganizationRole, director_area: area };
}

export interface PositionInput {
  email?: unknown;
  role?: unknown;
  director_area?: unknown;
  started_on?: unknown;
  ended_on?: unknown;
}

async function savePosition(write: () => Promise<unknown>) {
  try {
    await write();
  } catch (error) {
    if (isUniqueViolation(error))
      throw new ConflictError("This person already has a current position in this organization");
    throw error;
  }
}

/** Adds a period by hand, usually a past one from before the app existed. */
export async function createOrganizationPosition(organizationId: number, input: PositionInput): Promise<PositionView[]> {
  await assertOrganizationExists(organizationId);
  if (typeof input.email !== "string" || !(await db("users").where({ email: input.email }).first()))
    throw new ValidationError("User does not exist");
  const { role, director_area } = parseRoleAndArea(input);
  const period = parsePeriod(input);

  await savePosition(() => db("organization_positions").insert({
    organization_id: organizationId,
    user_email: input.email as string,
    role,
    director_area,
    ...period,
  }));
  return listOrganizationPositions(organizationId);
}

async function positionRow(organizationId: number, id: number) {
  const row = await db("organization_positions").where({ id, organization_id: organizationId }).first();
  if (!row) throw new NotFoundError(`Position ${id} not found`);
  return row;
}

/** Fixes the role or the dates of a period. */
export async function updateOrganizationPosition(organizationId: number, id: number, input: PositionInput): Promise<PositionView[]> {
  const row = await positionRow(organizationId, id);
  const { role, director_area } = parseRoleAndArea({
    role: input.role ?? row.role,
    director_area: input.director_area === undefined ? row.director_area : input.director_area,
  });
  const period = parsePeriod({
    started_on: input.started_on ?? row.started_on,
    ended_on: input.ended_on === undefined ? row.ended_on : input.ended_on,
  });
  await savePosition(() => db("organization_positions").where({ id }).update({ role, director_area, ...period }));
  return listOrganizationPositions(organizationId);
}

/** Deletes a period entered by mistake (to end a current one, set its `ended_on`). */
export async function deleteOrganizationPosition(organizationId: number, id: number): Promise<PositionView[]> {
  await positionRow(organizationId, id);
  await db("organization_positions").where({ id }).delete();
  return listOrganizationPositions(organizationId);
}
