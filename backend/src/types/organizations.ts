export type OrganizationRole = "aluno" | "membro" | "conselheiro" | "diretor" | "presidente" | "vice";

export interface Organization {
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

/** Row shape of `organization_positions`: one period in a role; `ended_on = null` means current. */
export interface OrganizationPosition {
    id: number;
    organization_id: Organization["id"];
    user_email: string;
    role: OrganizationRole;
    director_area: string | null;
    started_on: string;
    ended_on: string | null;
}

declare module "knex/types/tables" {
    interface Tables {
        organizations: Organization;
        organization_positions: OrganizationPosition;
    }
}
