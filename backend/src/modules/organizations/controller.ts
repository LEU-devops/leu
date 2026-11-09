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
