import { useState, type FormEvent } from 'react'
import { deleteEvent, setEventResults, updateEvent, type EventsView } from '../../services/competition'
import { EVENT_KINDS, type EventKind, type ModalityEvent, type Team } from '../../types/competition'
import TeamLogo from '../bracket/TeamLogo'
import Select from '../Select'
import { ERROR_BOX, errorMessage, GHOST_BUTTON, INPUT_CLASS, PRIMARY_BUTTON } from './shared'

const KIND_BADGE: Record<EventKind, string> = {
    normal: 'hidden',
    demonstrativa: 'border-zinc-600/60 bg-zinc-800/60 text-zinc-300',
    revezamento: 'border-amber-700/60 bg-amber-950/40 text-amber-200',
}

interface Props {
    code: string
    event: ModalityEvent
    /** Registered teams: the options of every position. */
    teams: Team[]
    canEdit: boolean
    onChange: (view: EventsView) => void
}

/** One event: its name, kind and state, and a table with the team of each position. */
export default function EventCard({ code, event, teams, canEdit, onChange }: Props) {
    const [error, setError] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(event.name)
    const [kind, setKind] = useState<EventKind>(event.kind)

    const kindInfo = EVENT_KINDS.find((k) => k.value === event.kind)!
    const teamById = new Map(teams.map((t) => [t.id, t]))
    const byPosition = new Map(event.results.map((r) => [r.position, r.team_id]))
    const maxPosition = Math.max(teams.length, ...event.results.map((r) => r.position))
    const positions = Array.from({ length: maxPosition }, (_, i) => i + 1)
    const placed = event.results.length
    const canFill = canEdit && !event.finished

    async function run(action: () => Promise<EventsView>, fallback: string): Promise<boolean> {
        setError(null)
        setIsBusy(true)
        try {
            onChange(await action())
            return true
        } catch (saveError) {
            setError(errorMessage(saveError, fallback))
            return false
        } finally {
            setIsBusy(false)
        }
    }

    function place(position: number, teamId: number | null) {
        const next = positions.map((p) => (p === position ? teamId : (byPosition.get(p) ?? null)))
        // Trailing empty positions are not sent, so the array never exceeds the registered teams.
        while (next.length > 0 && next[next.length - 1] === null) next.pop()
        run(() => setEventResults(code, event.id, next), 'Não foi possível salvar o resultado.')
    }

    async function save(formEvent: FormEvent<HTMLFormElement>) {
        formEvent.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        if (trimmed === event.name && kind === event.kind) {
            setIsEditing(false)
            return
        }
        const ok = await run(() => updateEvent(code, event.id, { name: trimmed, kind }), 'Não foi possível alterar a prova.')
        if (ok) setIsEditing(false)
    }

    function startEditing() {
        setName(event.name)
        setKind(event.kind)
        setIsEditing(true)
    }

    function remove() {
        const warning = placed > 0 ? `\nOs ${placed} ${placed === 1 ? 'resultado registrado será perdido' : 'resultados registrados serão perdidos'}.` : ''
        if (!window.confirm(`Remover a prova "${event.name}"?${warning}`)) return
        run(() => deleteEvent(code, event.id), 'Não foi possível remover a prova.')
    }

    function toggleFinished() {
        run(() => updateEvent(code, event.id, { finished: !event.finished }), 'Não foi possível alterar a prova.')
    }

    return (
        <article className={`flex flex-col rounded-2xl border bg-black/65 shadow-lg shadow-black/30 transition ${event.finished ? 'border-white/10' : 'border-red-950/60'} ${isBusy ? 'opacity-60' : ''}`}>
            <header className="flex flex-wrap items-start gap-2 border-b border-white/10 px-4 py-3">
                {isEditing ? (
                    <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={save}>
                        <input className={`${INPUT_CLASS} min-w-0 flex-1`} value={name} required autoFocus disabled={isBusy} aria-label="Nome da prova" onChange={(e) => setName(e.target.value)} />
                        <select className={INPUT_CLASS} value={kind} disabled={isBusy} aria-label="Tipo da prova" onChange={(e) => setKind(e.target.value as EventKind)}>
                            {EVENT_KINDS.map((k) => (
                                <option key={k.value} value={k.value}>
                                    {k.label}
                                </option>
                            ))}
                        </select>
                        <button type="submit" className={PRIMARY_BUTTON} disabled={isBusy || !name.trim()}>
                            Salvar
                        </button>
                        <button type="button" className={GHOST_BUTTON} disabled={isBusy} onClick={() => setIsEditing(false)}>
                            Cancelar
                        </button>
                    </form>
                ) : (
                    <>
                        <div className="min-w-0 flex-1 basis-56">
                            <h4 className="flex flex-wrap items-center gap-2 font-semibold text-zinc-50">
                                <span className="truncate">{event.name}</span>
                                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${KIND_BADGE[event.kind]}`} title={kindInfo.hint}>
                                    {kindInfo.label}
                                </span>
                            </h4>
                            <p className="text-xs text-zinc-500">
                                {event.finished ? 'Encerrada' : 'Em andamento'} · {placed} de {teams.length} {teams.length === 1 ? 'posição' : 'posições'}
                                {event.kind === 'normal' ? '' : ` · ${kindInfo.hint.toLowerCase()}`}
                            </p>
                        </div>
                        {canEdit ? (
                            <span className="ml-auto flex items-center gap-1">
                                <button type="button" className={`${GHOST_BUTTON} ${event.finished ? '' : 'text-emerald-300 hover:text-emerald-200'}`} disabled={isBusy} onClick={toggleFinished}>
                                    {event.finished ? 'Reabrir' : 'Encerrar'}
                                </button>
                                <button type="button" className={GHOST_BUTTON} disabled={isBusy} onClick={startEditing}>
                                    Editar
                                </button>
                                <button type="button" className={`${GHOST_BUTTON} hover:bg-red-950/60 hover:text-red-200`} disabled={isBusy} onClick={remove}>
                                    Remover
                                </button>
                            </span>
                        ) : null}
                    </>
                )}
            </header>

            {error ? <p className={`${ERROR_BOX} m-3`}>{error}</p> : null}

            {teams.length === 0 ? (
                <p className="px-4 py-3 text-sm text-zinc-500">Inscreva times para preencher as colocações.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            <th scope="col" className="w-10 whitespace-nowrap px-3 py-2 text-right">#</th>
                            <th scope="col" className="w-full px-2 py-2 text-left">Time</th>
                            <th scope="col" className="w-14 whitespace-nowrap px-3 py-2 text-right" title={kindInfo.hint}>Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((position) => {
                            const teamId = byPosition.get(position) ?? null
                            const team = teamId === null ? null : (teamById.get(teamId) ?? null)
                            const points = event.points_by_position[position - 1] ?? 0
                            const options = teams
                                .filter((t) => t.id === teamId || !event.results.some((r) => r.team_id === t.id))
                                .map((t) => ({ value: t.id, label: t.name, icon: <TeamLogo name={t.name} className="h-5 w-5" /> }))
                            return (
                                <tr key={position} className="border-t border-white/5">
                                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-zinc-500">{position}º</td>
                                    <td className="px-2 py-1.5">
                                        {canFill ? (
                                            <span className="flex items-center gap-1">
                                                <Select value={teamId ?? ''} options={options} onChange={(id) => place(position, id)} placeholder="—" className="py-1.5" />
                                                {teamId !== null ? (
                                                    <button type="button" className={`${GHOST_BUTTON} shrink-0`} disabled={isBusy} aria-label={`Limpar ${position}º lugar`} title="Limpar" onClick={() => place(position, null)}>
                                                        ×
                                                    </button>
                                                ) : null}
                                            </span>
                                        ) : team ? (
                                            <span className="flex items-center gap-2 text-zinc-100">
                                                <TeamLogo name={team.name} className="h-5 w-5" />
                                                <span className="truncate">{team.name}</span>
                                            </span>
                                        ) : (
                                            <span className="text-zinc-600">—</span>
                                        )}
                                    </td>
                                    <td className={`px-3 py-1.5 text-right tabular-nums ${team && points > 0 ? 'font-semibold text-zinc-50' : 'text-zinc-600'}`}>
                                        {event.kind === 'demonstrativa' ? '–' : points}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </article>
    )
}
