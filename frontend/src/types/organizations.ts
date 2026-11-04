export type OrganizationRole =
  | "aluno"
  | "membro"
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
