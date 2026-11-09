import { Link } from 'react-router-dom'
import { MedalIcon, TrophyIcon } from '../badges/BadgeIcons'
import type { PublicProfile } from '../../types/sports'
import { participationResult, placementColor } from '../../utils/awards'

/** The championships a person played, most recent first, with the awards they got in each. */
export default function ProfileParticipations({ profile }: { profile: PublicProfile }) {
    if (profile.participations.length === 0)
        return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">Nenhum campeonato registrado.</p>

    return (
        <ul className="space-y-2">
            {profile.participations.map((participation) => {
                const color = placementColor(participation.placement)
                const what = participation.kind === 'copa' ? participation.modality?.name : participation.team?.name
                const to = participation.kind === 'copa'
                    ? `/entidades/${participation.organization.id}/copas`
                    : participation.team ? `/times/${participation.team.id}` : `/entidades/${participation.organization.id}`
                const mine = participation.awards.filter((award) => award.recipients.some((recipient) => recipient.email === profile.email))
                return (
                    <li key={participation.id}>
                        <Link to={to} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/20">
                            <TrophyIcon color={color} className={`h-8 w-8 shrink-0 ${participation.placement !== null && participation.placement <= 3 ? '' : 'opacity-60'}`} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-zinc-100">{participation.competition} {participation.year}</span>
                                <span className="block truncate text-xs text-zinc-400">{[what, participation.organization.name].filter(Boolean).join(' · ')}</span>
                                {mine.length > 0 ? (
                                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-300">
                                        {mine.map((award) => (
                                            <span key={award.id} className="inline-flex items-center gap-1"><MedalIcon className="h-4 w-4" />{award.title}</span>
                                        ))}
                                    </span>
                                ) : null}
                            </span>
                            <span className="text-xs font-semibold" style={{ color }}>{participationResult(participation)}</span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
