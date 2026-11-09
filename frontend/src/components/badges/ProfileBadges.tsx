import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Award, PublicProfile } from '../../types/sports'
import { roleLabel } from '../../utils/roles'
import { organizationBackground } from '../../utils/gradient'
import OrganizationLogo from '../OrganizationLogo'
import { ColumnsIcon, JerseyIcon, MedalIcon, StarIcon, TrophyIcon, WhistleIcon } from './BadgeIcons'
import { PLACEMENT_COLORS, PLACEMENT_LABELS } from '../../utils/awards'

type BadgeGroup = 'Gestão' | 'Entidades' | 'Times' | 'Premiações' | 'Conquistas'

const GROUP_ORDER: BadgeGroup[] = ['Gestão', 'Times', 'Premiações', 'Conquistas', 'Entidades']

export interface Badge {
    key: string
    group: BadgeGroup
    label: string
    detail: string
    icon: ReactNode
    /** Background of the round tile (CSS `background`). */
    background: string
    /** Ring color around the tile. */
    ring?: string | null
    to?: string
}

const DARK_TILE = 'radial-gradient(circle at 30% 25%, rgb(63 63 70), rgb(9 9 11))'

function awardDetail(award: Award): string {
    return [
        award.placement ? PLACEMENT_LABELS[award.placement] : null,
        [award.competition, award.year].filter(Boolean).join(' '),
        award.team?.name,
        award.organization.name,
    ].filter(Boolean).join(' · ')
}

/** Every badge a profile earns, derived from positions, teams and awards. */
function computeBadges(profile: PublicProfile): Badge[] {
    const badges: Badge[] = []

    for (const position of profile.organizations) {
        const { organization } = position
        const isAluno = position.role === 'aluno'
        badges.push({
            key: `org-${organization.id}`,
            group: isAluno ? 'Entidades' : 'Gestão',
            label: organization.name,
            detail: isAluno ? 'Aluno(a)' : roleLabel(position),
            icon: <OrganizationLogo organization={organization} className="h-10 w-10 border-0 bg-transparent" />,
            background: organizationBackground(organization.gradient),
            ring: organization.accent_color,
            to: `/entidades/${organization.id}`,
        })
    }

    const internalBoard = profile.organizations.filter(
        (position) => position.organization.name !== 'LEU' && (position.role === 'presidente' || position.role === 'vice'),
    )
    if (internalBoard.length > 0) {
        badges.push({
            key: 'diretoria-interna',
            group: 'Gestão',
            label: 'Diretoria Interna',
            detail: `LEU · ${internalBoard.map((position) => position.organization.name).join(', ')}`,
            icon: <ColumnsIcon />,
            background: 'linear-gradient(135deg, #7f1d1d 0%, #111827 100%)',
        })
    }

    for (const team of profile.teams) {
        badges.push({
            key: `team-${team.id}`,
            group: 'Times',
            label: team.name,
            detail: `Atleta · ${team.organization.name}`,
            icon: <JerseyIcon color={team.organization.accent_color ?? '#f4f4f5'} />,
            background: organizationBackground(team.organization.gradient),
            ring: team.organization.accent_color,
            to: `/times/${team.id}`,
        })
        if (team.is_dm) {
            badges.push({
                key: `dm-${team.id}`,
                group: 'Times',
                label: 'DM',
                detail: `${team.name} · ${team.organization.name}`,
                icon: <WhistleIcon />,
                background: organizationBackground(team.organization.gradient),
                ring: '#f4f4f5',
                to: `/times/${team.id}`,
            })
        }
    }

    for (const award of profile.awards) {
        const color = PLACEMENT_COLORS[award.placement ?? 'none']
        badges.push({
            key: `award-${award.id}`,
            group: 'Premiações',
            label: award.title,
            detail: awardDetail(award),
            icon: award.kind === 'equipe' ? <TrophyIcon color={color} /> : <MedalIcon color={color} />,
            background: DARK_TILE,
            ring: color,
            to: award.team ? `/times/${award.team.id}` : undefined,
        })
    }

    if (profile.teams.length >= 2) {
        badges.push({
            key: 'multiatleta',
            group: 'Conquistas',
            label: 'Multiatleta',
            detail: `Joga em ${profile.teams.length} times`,
            icon: <StarIcon color="#38bdf8" />,
            background: DARK_TILE,
            ring: '#38bdf8',
        })
    }

    const golds = profile.awards.filter((award) => award.placement === 'ouro').length
    if (golds >= 2) {
        badges.push({
            key: 'multicampeao',
            group: 'Conquistas',
            label: 'Multicampeão',
            detail: `${golds} ouros`,
            icon: <StarIcon color={PLACEMENT_COLORS.ouro} />,
            background: DARK_TILE,
            ring: PLACEMENT_COLORS.ouro,
        })
    }

    return badges
}

function BadgeTile({ badge }: { badge: Badge }) {
    const content = (
        <>
            <span
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-black/40 ring-2 transition group-hover:-translate-y-0.5"
                style={{ background: badge.background, ['--tw-ring-color' as string]: badge.ring ?? 'rgb(255 255 255 / 0.12)' }}
            >
                {badge.icon}
            </span>
            <span className="mt-2 line-clamp-2 text-center text-xs font-semibold text-zinc-100">{badge.label}</span>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-zinc-500">{badge.detail}</span>
        </>
    )
    const className = 'group flex w-24 flex-col items-center'
    return (
        <li title={`${badge.label} — ${badge.detail}`}>
            {badge.to ? <Link to={badge.to} className={className}>{content}</Link> : <div className={className}>{content}</div>}
        </li>
    )
}

/** Badges of a profile, grouped (Gestão, Times, Premiações, Conquistas, Entidades). */
export default function ProfileBadges({ profile }: { profile: PublicProfile }) {
    const badges = computeBadges(profile)

    if (badges.length === 0)
        return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">Nenhuma badge ainda.</p>

    return (
        <div className="space-y-6">
            {GROUP_ORDER.map((group) => {
                const list = badges.filter((badge) => badge.group === group)
                if (list.length === 0)
                    return null
                return (
                    <section key={group} className="space-y-3">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">{group}</h3>
                            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                            <span className="text-xs tabular-nums text-zinc-500">{list.length}</span>
                        </div>
                        <ul className="flex flex-wrap gap-x-3 gap-y-5">
                            {list.map((badge) => <BadgeTile key={badge.key} badge={badge} />)}
                        </ul>
                    </section>
                )
            })}
        </div>
    )
}
