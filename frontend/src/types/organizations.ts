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

export interface UserSearchResult {
  email: string;
  name: string;
  full_name: string | null;
  profile_photo_url: string | null;
}

export interface MemberAddition {
  email: string;
  role: OrganizationRole;
  director_area: string | null;
}

export interface MembersChange {
  add: MemberAddition[];
  remove: string[];
}
