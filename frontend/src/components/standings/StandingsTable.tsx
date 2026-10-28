import { useState, type KeyboardEvent } from 'react'
import TeamLogo from '../bracket/TeamLogo'
import { formatPosition, formatRange, type Range, type Standings, type StandingsCell, type StandingsModality, type StandingsTeam } from '../../types/standings'

const HEADER_CELL = 'px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500'
const STICKY_COLUMN = 'sticky left-0 z-10 bg-[#0b0b0b]'

/** Highest maximum first; ties broken by the minimum, then by name. */
function compareTeams(a: StandingsTeam, b: StandingsTeam): number {
    return b.total.max - a.total.max || b.total.min - a.total.min || a.name.localeCompare(b.name)
}

function RangeText({ range, settledClass = 'text-zinc-50' }: { range: Range; settledClass?: string }) {
    const isSettled = range.min === range.max
    return <span className={`tabular-nums ${isSettled ? `font-semibold ${settledClass}` : 'text-zinc-300'}`}>{formatRange(range)}</span>
}

function ModalityHeader({ modality }: { modality: StandingsModality }) {
    const hasBracket = modality.team_count > 0
    const state = modality.error ? 'Erro ao pontuar' : !hasBracket ? 'Sem chave' : modality.finished ? 'Encerrada' : 'Em andamento'
    const title = `${modality.name} · ${state}${hasBracket ? ` · ${modality.team_count} times` : ''}${modality.error ? `\n${modality.error}` : ''}`
    return (
        <th scope="col" className={`${HEADER_CELL} text-center ${hasBracket && !modality.error ? '' : 'text-zinc-700'}`} title={title}>
            <span className="flex flex-col items-center gap-0.5">
                <span className="tracking-[0.15em]">{modality.code}</span>
                <span className="text-[9px] font-normal tracking-normal normal-case">
                    {modality.error ? <span className="text-amber-400">erro</span> : !hasBracket ? '—' : modality.finished ? 'fim' : `${modality.team_count} times`}
                </span>
            </span>
        </th>
    )
}

function PointsCell({ cell }: { cell: StandingsCell | null }) {
    if (!cell) return <td className="px-2 py-2 text-center text-zinc-700">–</td>

    const title = `Colocação: ${formatPosition(cell.position)}${cell.status === 'alive' ? ' (ainda em jogo)' : ''}${cell.walkover_loss ? '\nDerrota por W.O.: não pontua' : ''}`
    return (
        <td className="px-2 py-1.5 text-center align-middle" title={title}>
            <span className="flex flex-col items-center leading-tight">
                {cell.points ? (
                    <RangeText range={cell.points} settledClass={cell.walkover_loss ? 'text-zinc-500' : 'text-zinc-50'} />
                ) : (
                    <span className="text-zinc-600" title="Modalidade com menos de 3 times não pontua">–</span>
                )}
                <span className={`text-[10px] tabular-nums ${cell.walkover_loss ? 'font-semibold text-amber-400' : 'text-zinc-500'}`}>
                    {cell.walkover_loss ? 'W.O.' : formatPosition(cell.position)}
                </span>
            </span>
        </td>
    )
}

/** On/off switch for the supporters bonus. */
function BonusToggle({ team, disabled, onChange }: { team: StandingsTeam; disabled: boolean; onChange: (earned: boolean) => void }) {
    const earned = team.bonus_torcida.earned
    return (
        <button
            type="button"
            role="switch"
            aria-checked={earned}
            aria-label={`Bônus de torcida de ${team.name}`}
            disabled={disabled}
            onClick={() => onChange(!earned)}
            className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                earned ? 'border-emerald-500/60 bg-emerald-600/80' : 'border-white/15 bg-white/10'
            }`}
        >
            <span className={`h-5 w-5 rounded-full bg-white shadow transition ${earned ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    )
}

/**
 * Numeric box for the penalty. The value is sent when the box loses focus or on Enter.
 * Rendered with `key={team.penalty_points}` so the draft resets whenever the server value changes.
 */
function PenaltyInput({ team, disabled, onChange }: { team: StandingsTeam; disabled: boolean; onChange: (points: number) => void }) {
    const [draft, setDraft] = useState(String(team.penalty_points))

    function commit() {
        const points = Number(draft)
        if (!Number.isInteger(points) || points < 0) {
            setDraft(String(team.penalty_points))
            return
        }
        if (points !== team.penalty_points) onChange(points)
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
            setDraft(String(team.penalty_points))
            event.currentTarget.blur()
        }
    }

    return (
        <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={draft}
            disabled={disabled}
            aria-label={`Penalidade de ${team.name}`}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            className={`w-16 rounded-lg border px-2 py-1 text-center tabular-nums outline-none transition focus:border-red-600 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark] ${
                team.penalty_points > 0 ? 'border-red-900/60 bg-red-950/30 font-semibold text-red-300' : 'border-white/10 bg-white/5 text-zinc-300'
            }`}
        />
    )
}

interface Props {
    standings: Standings
    /** When set, the bonus and penalty columns become editable. */
    onScoringChange?: (teamId: number, scoring: { bonusTorcida?: boolean; penaltyPoints?: number }) => Promise<void>
    /** Id of the team whose scoring is being saved. */
    savingTeamId?: number | null
}

export default function StandingsTable({ standings, onScoringChange, savingTeamId = null }: Props) {
    const teams = [...standings.teams].sort(compareTeams)
    const modalities = standings.modalities
    const canEdit = onScoringChange !== undefined

    return (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/65 shadow-lg shadow-black/30">
            <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                    <tr className="border-b border-white/10">
                        <th scope="col" className={`${HEADER_CELL} ${STICKY_COLUMN} w-8 text-right`}>#</th>
                        <th scope="col" className={`${HEADER_CELL} ${STICKY_COLUMN} left-8 text-left`}>Time</th>
                        {modalities.map((modality) => (
                            <ModalityHeader key={modality.code} modality={modality} />
                        ))}
                        <th scope="col" className={`${HEADER_CELL} border-l border-white/10 text-center`} title="Bônus de torcida (2 pontos)">Torcida</th>
                        <th scope="col" className={`${HEADER_CELL} text-center`} title="Pontos de penalidade">Pen.</th>
                        <th scope="col" className={`${HEADER_CELL} text-right text-red-400`}>Máx</th>
                        <th scope="col" className={`${HEADER_CELL} text-right`}>Mín</th>
                    </tr>
                </thead>
                <tbody>
                    {teams.map((team, index) => {
                        const isSaving = savingTeamId === team.id
                        return (
                            <tr key={team.id} className={`border-b border-white/5 transition last:border-0 hover:bg-white/3 ${isSaving ? 'opacity-60' : ''}`}>
                                <td className={`${STICKY_COLUMN} px-2 py-2 text-right text-xs tabular-nums text-zinc-500`}>{index + 1}</td>
                                <th scope="row" className={`${STICKY_COLUMN} left-8 px-2 py-2 text-left font-medium text-zinc-100`}>
                                    <span className="flex items-center gap-2">
                                        <TeamLogo name={team.name} className="h-6 w-6" />
                                        <span className="truncate">{team.name}</span>
                                    </span>
                                </th>
                                {modalities.map((modality) => (
                                    <PointsCell key={modality.code} cell={team.modalities[modality.code] ?? null} />
                                ))}
                                <td className="border-l border-white/10 px-2 py-1.5 text-center align-middle">
                                    {canEdit ? (
                                        <span className="inline-flex items-center justify-center gap-2">
                                            <BonusToggle team={team} disabled={isSaving} onChange={(earned) => onScoringChange(team.id, { bonusTorcida: earned })} />
                                            <span className={`w-6 text-left text-xs tabular-nums ${team.bonus_torcida.earned ? 'font-semibold text-emerald-400' : 'text-zinc-700'}`}>
                                                {team.bonus_torcida.earned ? `+${team.bonus_torcida.points}` : '–'}
                                            </span>
                                        </span>
                                    ) : team.bonus_torcida.earned ? (
                                        <span className="font-semibold tabular-nums text-emerald-400">+{team.bonus_torcida.points}</span>
                                    ) : (
                                        <span className="text-zinc-700">–</span>
                                    )}
                                </td>
                                <td className="px-2 py-1.5 text-center align-middle">
                                    {canEdit ? (
                                        <PenaltyInput key={team.penalty_points} team={team} disabled={isSaving} onChange={(points) => onScoringChange(team.id, { penaltyPoints: points })} />
                                    ) : team.penalty_points > 0 ? (
                                        <span className="font-semibold tabular-nums text-red-400">−{team.penalty_points}</span>
                                    ) : (
                                        <span className="text-zinc-700">–</span>
                                    )}
                                </td>
                                <td className="px-2 py-2 text-right text-base">
                                    <RangeText range={{ min: team.total.max, max: team.total.max }} />
                                </td>
                                <td className="px-2 py-2 text-right text-base">
                                    <RangeText range={{ min: team.total.min, max: team.total.min }} settledClass="text-zinc-300" />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
