import type { ScheduledMatch } from '../../types/competition'
import type { Standings } from '../../types/standings'

interface CardProps {
    label: string
    /** The headline number. */
    value: number
    /** What the headline is out of; drawn as a progress bar when set. */
    total?: number
    detail: string
}

function Card({ label, value, total, detail }: CardProps) {
    const ratio = total ? Math.min(1, value / total) : null
    return (
        <div className="rounded-2xl border border-white/10 bg-black/65 px-5 py-4 shadow-lg shadow-black/30">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">{label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-zinc-50">{value}</span>
                {total !== undefined ? <span className="text-sm tabular-nums text-zinc-500">de {total}</span> : null}
            </p>
            {ratio !== null ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div className="h-full rounded-full bg-red-600 transition-[width]" style={{ width: `${ratio * 100}%` }} />
                </div>
            ) : null}
            <p className="mt-2 text-xs text-zinc-400">{detail}</p>
        </div>
    )
}

interface Props {
    standings: Standings
    matches: ScheduledMatch[]
}

/** Quick numbers above the standings table: finished modalities, games played and teams that can still win overall. */
export default function SummaryCards({ standings, matches }: Props) {
    const withBracket = standings.modalities.filter((m) => m.team_count > 0)
    const finished = withBracket.filter((m) => m.finished).length
    const inProgress = withBracket.length - finished
    const withoutBracket = standings.modalities.length - withBracket.length

    const played = matches.filter((m) => m.winner_id !== null).length
    const remaining = matches.length - played

    // A team can still be overall champion while its best total reaches the worst total of every other team.
    const contenders = standings.teams.filter((team) => {
        const bestRival = Math.max(...standings.teams.filter((other) => other.id !== team.id).map((other) => other.total.min))
        return team.total.max >= bestRival
    }).length
    const out = standings.teams.length - contenders

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <Card
                label="Modalidades encerradas"
                value={finished}
                total={standings.modalities.length}
                detail={[
                    inProgress > 0 ? `${inProgress} em andamento` : null,
                    withoutBracket > 0 ? `${withoutBracket} sem chave` : null,
                ].filter(Boolean).join(' · ') || 'Todas as modalidades encerradas.'}
            />
            <Card
                label="Jogos realizados"
                value={played}
                total={matches.length}
                detail={matches.length === 0 ? 'Nenhuma chave criada.' : remaining === 0 ? 'Todos os jogos realizados.' : `${remaining} ${remaining === 1 ? 'jogo por acontecer' : 'jogos por acontecer'}`}
            />
            <Card
                label="Na disputa pelo título"
                value={contenders}
                total={standings.teams.length}
                detail={out === 0 ? 'Todos os times ainda podem ser campeões gerais.' : `${out} ${out === 1 ? 'time já não alcança' : 'times já não alcançam'} o primeiro lugar geral`}
            />
        </div>
    )
}
