import { db } from "../../services/db";

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

export interface OrganizationHierarchy {
  id: number;
  name: string;
  description: string | null;
  gradient: string;
  members: OrganizationMember[];
}

export class NotFoundError extends Error {
  name = "Not Found Error";
}

export class ValidationError extends Error {
  name = "Validation Error";
}

export class ForbiddenError extends Error {
  name = "Forbidden Error";
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
const SECRETARIA_AREA = "secretaria";

/** Presidents and secretaries (diretores da Secretaria) manage their organization's members. */
function isMemberManagerRole(role: string, directorArea: string | null): boolean {
  if (role === "presidente") return true;
  return (
    role === "diretor" &&
    (directorArea ?? "").trim().toLowerCase() === SECRETARIA_AREA
  );
}

/**
 * Whether `email` can manage the members of organization `organizationId`:
 * presidents and secretaries of that organization, or of the LEU (which manages all).
 */
export async function canManageMembers(
  email: string,
  organizationId: number,
): Promise<boolean> {
  const rows = await db("organization_users as ou")
    .join("organizations as o", "o.id", "ou.organization_id")
    .where("ou.user_email", email)
    .andWhere((query) =>
      query
        .where("ou.organization_id", organizationId)
        .orWhere("o.name", LEU_NAME),
    )
    .select<{ role: string; director_area: string | null }[]>(
      "ou.role",
      "ou.director_area",
    );

  return rows.some((row) => isMemberManagerRole(row.role, row.director_area));
}

export async function assertCanManageMembers(
  email: string,
  organizationId: number,
): Promise<void> {
  const exists = await db("organizations").where({ id: organizationId }).first();
  if (!exists) throw new NotFoundError(`Organization ${organizationId} not found`);
  if (!(await canManageMembers(email, organizationId)))
    throw new ForbiddenError("Only presidents and secretaries can manage members");
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
 * Applies removals, then additions, atomically. Removing and re-adding the same
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
      const existing = await trx("organization_users")
        .where({ organization_id: organizationId })
        .whereIn("user_email", removals)
        .select("user_email");
      if (existing.length !== new Set(removals).size)
        throw new ValidationError("Some removed users are not members");

      await trx("organization_users")
        .where({ organization_id: organizationId })
        .whereIn("user_email", removals)
        .delete();
    }

    if (additions.length > 0) {
      const users = await trx("users").whereIn("email", addedEmails).select("email");
      if (users.length !== addedEmails.length)
        throw new ValidationError("Some added users do not exist");

      const alreadyMembers = await trx("organization_users")
        .where({ organization_id: organizationId })
        .whereIn("user_email", addedEmails)
        .select("user_email");
      if (alreadyMembers.length > 0)
        throw new ValidationError(
          `Already a member: ${alreadyMembers.map((row) => row.user_email).join(", ")}`,
        );

      await trx("organization_users").insert(
        additions.map((addition) => ({
          organization_id: organizationId,
          user_email: addition.email,
          role: addition.role,
          director_area: addition.director_area,
        })),
      );
    }
  });

  return getOrganizationHierarchy(organizationId);
}

interface OrganizationRow {
  id: number;
  name: string;
  description: string | null;
  gradient: string;
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
    .select<OrganizationRow[]>("id", "name", "description", "gradient")
    .orderByRaw("CASE WHEN name = ? THEN 0 ELSE 1 END", ["LEU"])
    .orderBy("name", "asc");

  const members = await db("organization_users as ou")
    .leftJoin("users as u", "u.email", "ou.user_email")
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
