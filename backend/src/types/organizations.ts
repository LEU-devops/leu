export type OrganizationRole = "aluno" | "membro" | "diretor" | "presidente" | "vice";

export interface Organization {
    id: number;
    name: string;
    description: string | null;
    gradient: string;
}

export interface OrganizationUser {
    organization_id: Organization["id"];
    user_email: string;
    role: OrganizationRole;
    director_area: string | null;
}

declare module "knex/types/tables" {
    interface Tables {
        organizations: Organization;
        organization_users: OrganizationUser;
    }
}
