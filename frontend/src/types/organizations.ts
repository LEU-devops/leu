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

export interface OrganizationIdentity {
  id: number;
  name: string;
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

export interface OrganizationPermissions {
  canManageMembers: boolean;
  canManageIdentity: boolean;
}

/** Editable text fields of the identity (images are uploaded separately). */
export type IdentityChange = Partial<Omit<OrganizationIdentity, "id" | "logo_url" | "banner_url">>;

export type IdentityImage = "logo" | "banner";

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
