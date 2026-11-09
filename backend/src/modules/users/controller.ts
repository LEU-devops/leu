import { db } from "../../services/db";
import { AwardView, listAwards } from "../awards/controller";
import { NotFoundError, organizationSummaries, OrganizationSummary, OrganizationRole } from "../organizations/controller";
import { listSportsTeams } from "../sports-teams/controller";

export interface PublicProfile {
    email: string;
    nickname: string;
    full_name: string | null;
    profile_photo_url: string | null;
    /** Positions in the LEU and AAAs (management and "aluno" affiliation). */
    organizations: { organization: OrganizationSummary, role: OrganizationRole, director_area: string | null }[];
    teams: { id: number, name: string, organization: OrganizationSummary, is_dm: boolean }[];
    awards: AwardView[];
}

/** What anyone can see of a user: no RA/CPF. Badges are derived from this on the frontend. */
export async function getPublicProfile(email: string): Promise<PublicProfile> {
    const user = await db("users")
        .select("email", "nickname", "full_name", "profile_photo_url")
        .where({ email })
        .first();
    if (!user) throw new NotFoundError(`User ${email} not found`);

    const positions = await db("organization_users")
        .where({ user_email: email })
        .select("organization_id", "role", "director_area");
    const organizations = await organizationSummaries(positions.map((position) => position.organization_id));

    const teams = await listSportsTeams({ memberEmail: email });

    return {
        ...user,
        organizations: positions.map((position) => ({
            organization: organizations.get(position.organization_id)!,
            role: position.role,
            director_area: position.director_area,
        })),
        teams: teams.map((team) => ({
            id: team.id,
            name: team.name,
            organization: team.organization,
            is_dm: team.members.some((member) => member.email === email && member.is_dm),
        })),
        awards: await listAwards({ email }),
    };
}
