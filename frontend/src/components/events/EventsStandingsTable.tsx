import type { ModalityEvent, Team } from '../../types/competition'
import { formatPosition, formatRange, type EventsPlacement, type EventsStandings, type Range } from '../../types/standings'
import TeamLogo from '../bracket/TeamLogo'

const HEADER_CELL = 'px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500'
const STICKY_COLUMN = 'sticky left-0 z-10 bg-[#0b0b0b]'

function RangeText({ range, settledClass = 'text-zinc-50' }: { range: Range; settledClass?: string }) {
    const isSettled = range.min === range.max
    return <span className={`tabular-nums ${isSettled ? `font-semibold ${settledClass}` : 'text-zinc-300'}`}>{formatRange(range)}</span>
}

function EventHeader({ event }: { event: ModalityEvent }) {
    const kind = event.kind === 'revezamento' ? ' · pontua em dobro' : event.kind === 'demonstrativa' ? ' · não pontua' : ''
    return (
        <th scope="col" className={`${HEADER_CELL} text-center ${event.kind === 'demonstrativa' ? 'text-zinc-700' : ''}`} title={`${event.name}${kind} · ${event.finished ? 'Encerrada' : 'Em andamento'}`}>
            <span className="flex flex-col items-center gap-0.5">
                <span className="block max-w-32 truncate tracking-[0.1em]">{event.name}</span>
                <span className="text-[9px] font-normal tracking-normal normal-case">
                    {event.kind === 'revezamento' ? <span className="text-amber-300">×2</span> : event.kind === 'demonstrativa' ? 'demo' : null}
                    {event.kind !== 'normal' ? ' · ' : ''}
                    {event.finished ? 'fim' : 'aberta'}
                </span>
            </span>
        </th>
    )
}

function EventPointsCell({ placement, event }: { placement: EventsPlacement; event: ModalityEvent }) {
    const cell = placement.events[event.id] ?? null
    if (!cell) return <td className="px-2 py-2 text-center text-zinc-700">–</td>
    const scores = event.kind !== 'demonstrativa'
    return (
        <td className="px-2 py-1.5 text-center align-middle" title={`${cell.position}º lugar${scores ? ` · ${cell.points} pontos` : ' · demonstrativa, não pontua'}`}>
            <span className="flex flex-col items-center leading-tight">
                <span className={`tabular-nums ${scores ? 'font-semibold text-zinc-50' : 'text-zinc-500'}`}>{scores ? cell.points : '–'}</span>
                <span className="text-[10px] tabular-nums text-zinc-500">{cell.position}º</span>
            </span>
        </td>
    )
}

interface Props {
    teams: Team[]
    events: ModalityEvent[]
    standings: EventsStandings
}

/**
 * The "Máx e Mín" of one events modality: a row per registered team with its points in every
 * event, the internal score, the final position and the points it takes to the overall standings.
 */
export default function EventsStandingsTable({ teams, events, standings }: Props) {
    const teamById = new Map(teams.map((t) => [t.id, t]))

    return (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/65 shadow-lg shadow-black/30">
            <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                    <tr className="border-b border-white/10">
                        <th scope="col" className={`${HEADER_CELL} ${STICKY_COLUMN} w-8 text-right`}>#</th>
                        <th scope="col" className={`${HEADER_CELL} ${STICKY_COLUMN} left-8 text-left`}>Time</th>
                        {events.map((event) => (
                            <EventHeader key={event.id} event={event} />
                        ))}
                        <th scope="col" className={`${HEADER_CELL} border-l border-white/10 text-right`} title="Soma dos pontos das provas (faixa enquanto houver provas abertas)">Pontos</th>
                        <th scope="col" className={`${HEADER_CELL} text-right`} title="Colocação final na modalidade">Coloc.</th>
                        <th scope="col" className={`${HEADER_CELL} text-right text-red-400`} title="Pontos levados para a tabela geral">Geral</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.placements.map((placement, index) => {
                        const team = teamById.get(placement.team_id)
                        const name = team?.name ?? `Time ${placement.team_id}`
                        const isChampion = placement.status === 'champion'
                        return (
                            <tr key={placement.team_id} className="border-b border-white/5 transition last:border-0 hover:bg-white/3">
                                <td className={`${STICKY_COLUMN} px-2 py-2 text-right text-xs tabular-nums text-zinc-500`}>{index + 1}</td>
                                <th scope="row" className={`${STICKY_COLUMN} left-8 px-2 py-2 text-left font-medium text-zinc-100`}>
                                    <span className="flex items-center gap-2">
                                        <TeamLogo name={name} className="h-6 w-6" />
                                        <span className="truncate">{name}</span>
                                        {isChampion ? <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">campeão</span> : null}
                                    </span>
                                </th>
                                {events.map((event) => (
                                    <EventPointsCell key={event.id} placement={placement} event={event} />
                                ))}
                                <td className="border-l border-white/10 px-2 py-2 text-right text-base">
                                    <RangeText range={placement.score} />
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums text-zinc-300" title={placement.status === 'alive' ? 'Ainda em disputa' : undefined}>
                                    {formatPosition(placement.position)}
                                </td>
                                <td className="px-2 py-2 text-right text-base">
                                    {placement.points ? (
                                        <RangeText range={placement.points} settledClass="text-red-300" />
                                    ) : (
                                        <span className="text-zinc-600" title="Modalidade com menos de 3 times não pontua">–</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
