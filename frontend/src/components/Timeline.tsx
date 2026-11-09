import { Link } from 'react-router-dom'
import type { OrganizationSummary, Period, PublicProfile } from '../types/sports'
import { roleLabel } from '../utils/roles'
import { isCurrent, mergePeriods, periodDates, periodYears } from '../utils/periods'
import OrganizationLogo from './OrganizationLogo'

interface Entry extends Period {
    key: string
    title: string
    to?: string
}

interface Group {
    organization: OrganizationSummary
    entries: Entry[]
}

/** Current entries first, then by the most recent end. */
function byRecency(a: Period, b: Period): number {
    return (b.ended_on ?? '9999').localeCompare(a.ended_on ?? '9999') || b.started_on.localeCompare(a.started_on)
}

/**
 * Builds one line per role: periods of the same role (or the same team and role) that touch
 * or overlap are merged; separate stretches stay as separate lines.
 */
function buildGroups(profile: PublicProfile): Group[] {
    const groups = new Map<number, Group>()
    const groupOf = (organization: OrganizationSummary) => {
        const group = groups.get(organization.id) ?? { organization, entries: [] }
        groups.set(organization.id, group)
        return group
    }

    const positionsByRole = new Map<string, PublicProfile['positions']>()
    for (const position of profile.positions) {
        if (position.role === 'aluno')
            continue
        const key = `${position.organization.id}|${roleLabel(position)}`
        positionsByRole.set(key, [...(positionsByRole.get(key) ?? []), position])
    }
    for (const [key, positions] of positionsByRole) {
        for (const period of mergePeriods(positions)) {
            groupOf(positions[0].organization).entries.push({
                key: `${key}|${period.started_on}`,
                title: roleLabel(positions[0]),
                started_on: period.started_on,
                ended_on: period.ended_on,
            })
        }
    }

    const stintsByRole = new Map<string, PublicProfile['team_stints']>()
    for (const stint of profile.team_stints) {
        const key = `${stint.team.id}|${stint.role}`
        stintsByRole.set(key, [...(stintsByRole.get(key) ?? []), stint])
    }
    for (const [key, stints] of stintsByRole) {
        const { team, organization, role } = stints[0]
        for (const period of mergePeriods(stints)) {
            groupOf(organization).entries.push({
                key: `${key}|${period.started_on}`,
                title: `${team.name} · ${role === 'dm' ? 'DM' : 'Atleta'}`,
                to: `/times/${team.id}`,
                started_on: period.started_on,
                ended_on: period.ended_on,
            })
        }
    }

    const list = [...groups.values()]
    for (const group of list)
        group.entries.sort(byRecency)
    return list.sort((a, b) => byRecency(a.entries[0], b.entries[0]))
}

/** LinkedIn-like history: roles and teams grouped by organization, with years. */
export default function Timeline({ profile }: { profile: PublicProfile }) {
    const groups = buildGroups(profile)

    if (groups.length === 0)
        return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">Nenhum cargo ou time ainda.</p>

    return (
        <ol className="space-y-4">
            {groups.map(({ organization, entries }) => (
                <li key={organization.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <Link to={`/entidades/${organization.id}`} className="mb-3 flex items-center gap-3">
                        <OrganizationLogo organization={organization} className="h-9 w-9" />
                        <span className="font-semibold text-zinc-100" style={{ color: organization.accent_color ?? undefined }}>{organization.name}</span>
                    </Link>
                    <ol className="relative ml-4 space-y-3 border-l border-white/10 pl-5">
                        {entries.map((entry) => {
                            const current = isCurrent(entry)
                            return (
                                <li key={entry.key} className="relative" title={periodDates(entry)}>
                                    <span
                                        className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-950 ${current ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                                        aria-hidden
                                    />
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                                        {entry.to
                                            ? <Link to={entry.to} className={`text-sm hover:underline ${current ? 'text-zinc-100' : 'text-zinc-400'}`}>{entry.title}</Link>
                                            : <span className={`text-sm ${current ? 'text-zinc-100' : 'text-zinc-400'}`}>{entry.title}</span>}
                                        <span className={`text-xs tabular-nums ${current ? 'text-emerald-300' : 'text-zinc-500'}`}>{periodYears(entry)}</span>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                </li>
            ))}
        </ol>
    )
}
