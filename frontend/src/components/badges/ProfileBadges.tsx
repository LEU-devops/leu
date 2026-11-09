import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Award, Period, PublicProfile } from '../../types/sports'
import { isCurrent, mergePeriods, periodYears } from '../../utils/periods'
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
    /** Held only in the past: shown faded, with an "ex-" label. */
    past?: boolean
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
type ProfilePosition = PublicProfile['positions'][number]
type ProfileStint = PublicProfile['team_stints'][number]

const isManagement = (position: ProfilePosition) => position.role !== 'aluno'
const isInternalBoard = (position: ProfilePosition) =>
    position.organization.name !== 'LEU' && (position.role === 'presidente' || position.role === 'vice')

function groupBy<T>(items: T[], key: (item: T) => string | number): Map<string | number, T[]> {
    const groups = new Map<string | number, T[]>()
    for (const item of items)
        groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
    return groups
}

/** Years of the latest stretch of these periods ("2024", "2023 – atual"). */
function latestYears(periods: Period[]): string {
    return periodYears(mergePeriods(periods)[0])
}

/** The most recent of some periods (current ones count as the most recent). */
function mostRecent<T extends Period>(periods: T[]): T {
    return [...periods].sort((a, b) => (b.ended_on ?? '9999').localeCompare(a.ended_on ?? '9999') || b.started_on.localeCompare(a.started_on))[0]
}

/**
 * Every badge a profile earns. Current roles give regular badges; roles held only in the past
 * give a faded "ex-" badge (no past badge when the same thing is current).
 */
function computeBadges(profile: PublicProfile): Badge[] {
    const badges: Badge[] = []

    for (const [, positions] of groupBy(profile.positions, (position) => position.organization.id)) {
        const { organization } = positions[0]
        const management = positions.filter(isManagement)
        const current = management.find(isCurrent)
        const shown = current ?? (management.length > 0 ? mostRecent(management) : null)
        if (shown) {
            const sameRole = management.filter((position) => roleLabel(position) === roleLabel(shown))
            badges.push({
                key: `org-${organization.id}`,
                group: 'Gestão',
                label: organization.name,
                detail: `${current ? '' : 'ex-'}${roleLabel(shown)} · ${latestYears(sameRole)}`,
                icon: <OrganizationLogo organization={organization} className="h-10 w-10 border-0 bg-transparent" />,
                background: organizationBackground(organization.gradient),
                ring: organization.accent_color,
                to: `/entidades/${organization.id}`,
                past: !current,
            })
        }
        const aluno = positions.find((position) => position.role === 'aluno' && isCurrent(position))
        if (aluno) {
            badges.push({
                key: `aluno-${organization.id}`,
                group: 'Entidades',
                label: organization.name,
                detail: 'Aluno(a)',
                icon: <OrganizationLogo organization={organization} className="h-10 w-10 border-0 bg-transparent" />,
                background: organizationBackground(organization.gradient),
                ring: organization.accent_color,
                to: `/entidades/${organization.id}`,
            })
        }
    }

    const board = profile.positions.filter(isInternalBoard)
    if (board.length > 0) {
        const current = board.filter(isCurrent)
        badges.push({
            key: 'diretoria-interna',
            group: 'Gestão',
            label: current.length > 0 ? 'Diretoria Interna' : 'ex-Diretoria Interna',
            detail: `LEU · ${[...new Set((current.length > 0 ? current : board).map((position) => position.organization.name))].join(', ')} · ${latestYears(board)}`,
            icon: <ColumnsIcon />,
            background: 'linear-gradient(135deg, #7f1d1d 0%, #111827 100%)',
            past: current.length === 0,
        })
    }

    for (const [, stints] of groupBy(profile.team_stints, (stint) => stint.team.id)) {
        const { team, organization } = stints[0]
        const role = (wanted: ProfileStint['role']) => stints.filter((stint) => stint.role === wanted)
        const athlete = role('atleta')
        const dm = role('dm')
        if (athlete.length > 0) {
            const current = athlete.some(isCurrent)
            badges.push({
                key: `team-${team.id}`,
                group: 'Times',
                label: team.name,
                detail: `${current ? 'Atleta' : 'ex-atleta'} · ${organization.name} · ${latestYears(athlete)}`,
                icon: <JerseyIcon color={organization.accent_color ?? '#f4f4f5'} />,
                background: organizationBackground(organization.gradient),
                ring: organization.accent_color,
                to: `/times/${team.id}`,
                past: !current,
            })
        }
        if (dm.length > 0) {
            const current = dm.some(isCurrent)
            badges.push({
                key: `dm-${team.id}`,
                group: 'Times',
                label: current ? 'DM' : 'ex-DM',
                detail: `${team.name} · ${organization.name} · ${latestYears(dm)}`,
                icon: <WhistleIcon />,
                background: organizationBackground(organization.gradient),
                ring: '#f4f4f5',
                to: `/times/${team.id}`,
                past: !current,
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

    const athleteTeams = new Set(profile.team_stints.filter((stint) => stint.role === 'atleta').map((stint) => stint.team.id))
    if (athleteTeams.size >= 2) {
        badges.push({
            key: 'multiatleta',
            group: 'Conquistas',
            label: 'Multiatleta',
            detail: `Jogou em ${athleteTeams.size} times`,
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

    // Current badges before past ones inside each group.
    return badges.sort((a, b) => Number(Boolean(a.past)) - Number(Boolean(b.past)))
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
    const className = `group flex w-24 flex-col items-center transition ${badge.past ? 'opacity-50 grayscale-[70%] hover:opacity-100 hover:grayscale-0' : ''}`
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
