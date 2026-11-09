import type { ReactNode } from 'react'
import type { Award } from '../types/sports'
import { MedalIcon, TrophyIcon } from './badges/BadgeIcons'
import { PLACEMENT_COLORS, PLACEMENT_LABELS } from '../utils/awards'

/** One award: trophy (team) or medal (individual) in the placement color, plus who got it. */
export default function AwardRow({ award, action }: { award: Award, action?: ReactNode }) {
    const color = PLACEMENT_COLORS[award.placement ?? 'none']
    return (
        <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            {award.kind === 'equipe' ? <TrophyIcon color={color} className="h-8 w-8 shrink-0" /> : <MedalIcon color={color} className="h-8 w-8 shrink-0" />}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">
                    {award.title}
                    {award.placement ? <span className="ml-2 text-xs font-medium" style={{ color }}>{PLACEMENT_LABELS[award.placement]}</span> : null}
                </p>
                <p className="truncate text-xs text-zinc-400">
                    {[award.competition, award.year, award.team?.name, award.kind === 'equipe' ? 'Equipe' : 'Individual'].filter(Boolean).join(' · ')}
                </p>
                <p className="truncate text-xs text-zinc-500" title={award.recipients.map((recipient) => recipient.name).join(', ')}>
                    {award.recipients.length === 1 ? award.recipients[0].name : `${award.recipients.length} premiados: ${award.recipients.map((recipient) => recipient.name).join(', ')}`}
                </p>
            </div>
            {action}
        </li>
    )
}
