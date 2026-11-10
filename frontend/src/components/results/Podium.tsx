import { Link } from 'react-router-dom'
import OrganizationLogo from '../OrganizationLogo'
import { TrophyIcon } from '../badges/BadgeIcons'
import type { ResultEntry } from '../../types/competition'
import { placementColor } from '../../utils/awards'

/** Positions 1–3 of a classification: the champion highlighted, then the other medalists. */
export default function Podium({ entries }: { entries: ResultEntry[] }) {
    const podium = entries.filter((entry) => entry.position <= 3)
    if (podium.length === 0)
        return <p className="text-sm text-zinc-500">Sem resultado registrado.</p>
    return (
        <ol className="flex flex-wrap items-center gap-2">
            {podium.map((entry) => {
                const champion = entry.position === 1
                return (
                    <li key={entry.organization.id}>
                        <Link
                            to={`/entidades/${entry.organization.id}`}
                            title={`${entry.position}º · ${entry.organization.name}`}
                            className={`flex items-center gap-2 rounded-2xl border bg-black/30 py-1 pl-1 pr-3 transition hover:border-white/25 ${champion ? 'border-amber-400/40' : 'border-white/10'}`}
                        >
                            <OrganizationLogo organization={entry.organization} className={champion ? 'h-9 w-9' : 'h-7 w-7'} />
                            <TrophyIcon color={placementColor(entry.position)} className={champion ? 'h-5 w-5' : 'h-4 w-4'} />
                            <span className={champion ? 'text-sm font-semibold text-zinc-50' : 'text-xs text-zinc-300'}>{entry.name}</span>
                        </Link>
                    </li>
                )
            })}
        </ol>
    )
}
