import OrganizationLogo from '../OrganizationLogo'
import Podium from './Podium'
import type { EditionResults } from '../../types/competition'
import { placementColor } from '../../utils/awards'

/** The saved final results of a closed edition: the overall classification and each modality's podium. */
export default function FinalResults({ results }: { results: EditionResults }) {
    const decided = results.modalities.filter((modality) => modality.results.length > 0)
    return (
        <div className="space-y-6">
            <section className="space-y-3">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Classificação final</h2>
                {results.overall.length === 0 ? (
                    <p className="text-sm text-zinc-500">A classificação geral desta edição não foi registrada.</p>
                ) : (
                    <ol className="overflow-hidden rounded-2xl border border-white/10">
                        {results.overall.map((entry) => (
                            <li key={entry.organization.id} className="flex items-center gap-3 border-b border-white/5 bg-white/[0.02] px-4 py-2 last:border-b-0">
                                <span className="w-8 text-right text-sm font-bold" style={{ color: placementColor(entry.position) }}>{entry.position}º</span>
                                <OrganizationLogo organization={entry.organization} className="h-8 w-8" />
                                <span className="flex-1 text-sm text-zinc-100">{entry.name}</span>
                                {entry.points !== null ? <span className="text-sm tabular-nums text-zinc-300">{entry.points} pts</span> : null}
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {decided.length > 0 ? (
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Pódios por modalidade</h2>
                    <ul className="grid gap-3 lg:grid-cols-2">
                        {decided.map((modality) => (
                            <li key={modality.code} className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-sm text-zinc-300"><span className="mr-2 font-bold tracking-wider text-zinc-400">{modality.code}</span>{modality.name}</p>
                                <Podium entries={modality.results} />
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    )
}
