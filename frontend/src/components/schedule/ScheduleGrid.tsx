import type { ScheduledMatch, Stage } from '../../types/competition'
import TeamLogo from '../bracket/TeamLogo'
import { buildHeader, formatDay, formatTime, ROW_HEIGHT_REM, slotsOf, type Column, type Day } from './layout'

const STAGE_NAMES: Record<Stage, string> = { r16: 'Oitavas', qf: 'Quartas', sf: 'Semifinal', final: 'Final' }

function TeamSide({ name, isWinner, align }: { name: string | null; isWinner: boolean; align: 'left' | 'right' }) {
    const label = (
        <span className={`min-w-0 truncate text-xs ${name ? (isWinner ? 'font-semibold text-zinc-50' : 'text-zinc-300') : 'italic text-zinc-500'}`}>
            {name ?? 'A definir'}
        </span>
    )
    const logo = name ? <TeamLogo name={name} className="h-6 w-6" /> : <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-white/15" />
    return (
        <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${align === 'left' ? 'justify-end' : ''}`}>
            {align === 'left' ? label : logo}
            {align === 'left' ? logo : label}
        </div>
    )
}

function Score({ value, isWinner }: { value: string | null; isWinner: boolean }) {
    return <span className={`w-6 shrink-0 text-center text-sm tabular-nums ${isWinner ? 'font-bold text-zinc-50' : 'text-zinc-300'}`}>{value ?? ''}</span>
}

function MatchCard({ match }: { match: ScheduledMatch }) {
    const aWins = match.winner_id !== null && match.winner_id === match.team_a_id
    const bWins = match.winner_id !== null && match.winner_id === match.team_b_id
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/80 shadow-lg shadow-black/30">
            {/* Header: modality, stage and time */}
            <div className="flex items-center gap-1.5 border-b border-white/10 px-2 py-1 text-[11px] leading-4 text-zinc-400">
                <span className="rounded bg-white/10 px-1.5 font-bold tracking-wider text-zinc-200" title={match.modality_name}>
                    {match.modality_code}
                </span>
                <span className="truncate">{STAGE_NAMES[match.stage] ?? match.stage}</span>
                {match.status === 'live' ? <span className="font-semibold uppercase tracking-widest text-red-400">Ao vivo</span> : null}
                <span className="ml-auto shrink-0 tabular-nums">{formatTime(new Date(match.scheduled_at as string))}</span>
            </div>

            {/* Center: TEAM A <logo> <score> X <score> <logo> TEAM B */}
            <div className="flex flex-1 items-center gap-1.5 px-2 py-2">
                <TeamSide name={match.team_a_name} isWinner={aWins} align="left" />
                <Score value={match.score_a} isWinner={aWins} />
                <span className="shrink-0 text-xs font-semibold text-zinc-500">X</span>
                <Score value={match.score_b} isWinner={bWins} />
                <TeamSide name={match.team_b_name} isWinner={bWins} align="right" />
            </div>

            {/* Footer: neutral team, centered */}
            {match.neutral_team_name ? (
                <p className="flex items-center justify-center gap-1 border-t border-white/10 px-2 py-1 text-[11px] leading-4 text-zinc-400" title={`Neutra: ${match.neutral_team_name}`}>
                    <span>Neutra:</span>
                    <TeamLogo name={match.neutral_team_name} className="h-4 w-4" />
                    <span className="truncate">{match.neutral_team_name}</span>
                </p>
            ) : null}
        </div>
    )
}

const stickyColumn = 'sticky left-0 z-20 bg-[#0b0b0b]'

export default function ScheduleGrid({ day, columns }: { day: Day; columns: Column[] }) {
    const header = buildHeader(columns)
    const firstTimeRow = header.depth + 1
    const slots = slotsOf(day)

    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{formatDay(day.date)}</h2>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(12rem, 1fr))`,
                        gridTemplateRows: `repeat(${header.depth}, auto) repeat(${day.rows}, ${ROW_HEIGHT_REM}rem)`,
                    }}
                >
                    {/* Top-left corner above the time axis */}
                    <div className={`${stickyColumn} border-b border-white/10`} style={{ gridColumn: 1, gridRow: `1 / span ${header.depth}` }} />

                    {/* Venue header, one row per nesting level */}
                    {header.cells.map((cell) => {
                        const isLeaf = cell.level + cell.rowSpan === header.depth
                        return (
                            <div
                                key={`${cell.level}-${cell.venue.id}`}
                                className={`flex items-center justify-center border-b border-l border-white/10 px-2 text-center ${
                                    isLeaf ? 'py-2 text-sm font-semibold text-zinc-100' : 'py-1.5 text-xs font-semibold uppercase tracking-widest text-red-300'
                                }`}
                                style={{ gridColumn: `${cell.colStart + 2} / span ${cell.colSpan}`, gridRow: `${cell.level + 1} / span ${cell.rowSpan}` }}
                                title={cell.venue.path}
                            >
                                <span className="truncate">{cell.venue.name}</span>
                            </div>
                        )
                    })}

                    {/* Time axis and horizontal guides, one per 1h30 slot */}
                    {slots.map((slot) => (
                        <div key={slot.row} className="contents">
                            <div
                                className={`${stickyColumn} border-t border-white/10 px-2 pt-1 text-xs tabular-nums text-zinc-400`}
                                style={{ gridColumn: 1, gridRow: `${firstTimeRow + slot.row} / span ${slot.rows}` }}
                            >
                                {formatTime(slot.time)}
                            </div>
                            <div
                                className="border-t border-white/10"
                                style={{ gridColumn: `2 / span ${columns.length}`, gridRow: `${firstTimeRow + slot.row} / span ${slot.rows}` }}
                            />
                        </div>
                    ))}

                    {/* Vertical guides between venues */}
                    {columns.map((_, index) => (
                        <div
                            key={index}
                            className="border-l border-white/10"
                            style={{ gridColumn: index + 2, gridRow: `${firstTimeRow} / span ${day.rows}` }}
                        />
                    ))}

                    {/* Matches */}
                    {day.cells.map((cell) => (
                        <div
                            key={cell.key}
                            className={`z-10 flex min-h-0 flex-col gap-1 p-1 ${cell.matches.length > 1 ? 'rounded-xl outline outline-red-700/70' : ''}`}
                            style={{
                                gridColumn: `${cell.colStart + 2} / span ${cell.colEnd - cell.colStart + 1}`,
                                gridRow: `${firstTimeRow + cell.row} / span 6`,
                            }}
                            title={cell.matches.length > 1 ? 'Conflito: mais de um jogo no mesmo local e horário' : undefined}
                        >
                            {cell.matches.map((match) => (
                                <MatchCard key={match.id} match={match} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
