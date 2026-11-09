import { db } from "../../services/db";
import { AwardView, listAwards } from "../awards/controller";
import { NotFoundError, organizationSummaries, OrganizationSummary, OrganizationRole } from "../organizations/controller";
import { StintRole } from "../../types/sports";
import { listParticipations, ParticipationView } from "../participations/controller";

interface Period {
    started_on: string;
    /** null = current. */
    ended_on: string | null;
}

export interface PublicProfile {
    email: string;
    nickname: string;
    full_name: string | null;
    profile_photo_url: string | null;
    /** Every period in the LEU and AAAs (management and "aluno" affiliation), current and past. */
    positions: (Period & { organization: OrganizationSummary, role: OrganizationRole, director_area: string | null })[];
    /** Every period as athlete or DM of a team, current and past. */
    team_stints: (Period & { team: { id: number, name: string }, organization: OrganizationSummary, role: StintRole })[];
    awards: AwardView[];
    /** Championships played (Copas and others), with results and the awards given there. */
    participations: ParticipationView[];
}

/** What anyone can see of a user: no RA/CPF. Badges and the timeline are derived from this on the frontend. */
export async function getPublicProfile(email: string): Promise<PublicProfile> {
    const user = await db("users")
        .select("email", "nickname", "full_name", "profile_photo_url")
        .where({ email })
        .first();
    if (!user) throw new NotFoundError(`User ${email} not found`);

    const positions = await db("organization_positions")
        .where({ user_email: email })
        .orderBy("started_on", "desc")
        .select("organization_id", "role", "director_area", "started_on", "ended_on");

    const stints = await db("sports_team_stints as s")
        .join("sports_teams as t", "t.id", "s.team_id")
        .where("s.user_email", email)
        .orderBy("s.started_on", "desc")
        .select<{ team_id: number, team_name: string, organization_id: number, role: StintRole, started_on: string, ended_on: string | null }[]>(
            "s.team_id", "t.name as team_name", "t.organization_id", "s.role", "s.started_on", "s.ended_on",
        );

    const organizations = await organizationSummaries([
        ...positions.map((position) => position.organization_id),
        ...stints.map((stint) => stint.organization_id),
    ]);

    return {
        ...user,
        positions: positions.map((position) => ({
            organization: organizations.get(position.organization_id)!,
            role: position.role,
            director_area: position.director_area,
            started_on: position.started_on,
            ended_on: position.ended_on,
        })),
        team_stints: stints.map((stint) => ({
            team: { id: stint.team_id, name: stint.team_name },
            organization: organizations.get(stint.organization_id)!,
            role: stint.role,
            started_on: stint.started_on,
            ended_on: stint.ended_on,
        })),
        awards: await listAwards({ email }),
        participations: await listParticipations({ email }),
    };
}
