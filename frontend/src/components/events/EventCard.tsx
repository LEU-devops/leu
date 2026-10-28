import { useState, type FormEvent } from 'react'
import { deleteEvent, setEventResults, updateEvent, type EventsView } from '../../services/competition'
import { athletesPerTeam, EVENT_FLAGS, type EventEntry, type EventFlags, type ModalityEvent, type Team } from '../../types/competition'
import TeamLogo from '../bracket/TeamLogo'
import Select from '../Select'
import EventFlagsFields from './EventFlagsFields'
import { ERROR_BOX, errorMessage, GHOST_BUTTON, INPUT_CLASS, PRIMARY_BUTTON } from './shared'

const FLAG_BADGE: Record<keyof EventFlags, string> = {
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

/** What a row says about its athlete besides the team: a second athlete, or a place that differs from the position. */
function entryNote(entry: EventEntry | null): string | null {
    if (!entry) return null
    if (!entry.scores) return '2º atleta'
    if (entry.place !== null && entry.place !== entry.position) return `${entry.place}º entre os times`
    return null
}

/** One event: its name, flags and state, and a table with the team of each position (up to 2 athletes per team). */
export default function EventCard({ code, event, teams, canEdit, onChange }: Props) {
    const [error, setError] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(event.name)
    const [flags, setFlags] = useState<EventFlags>({ demonstrativa: event.demonstrativa, revezamento: event.revezamento })

    const perTeam = athletesPerTeam(event)
    const teamById = new Map(teams.map((t) => [t.id, t]))
    const byPosition = new Map(event.results.map((r) => [r.position, r]))
    const lastFilled = Math.max(0, ...event.results.map((r) => r.position))
    const canFill = canEdit && !event.finished
    // Filled positions plus one empty row to grow into, never beyond what the registered teams can enter.
    const rowCount = canFill ? Math.min(teams.length * perTeam, lastFilled + 1) : lastFilled
    const positions = Array.from({ length: rowCount }, (_, i) => i + 1)
    const athletes = event.results.length
    const teamsIn = new Set(event.results.map((r) => r.team_id)).size
    const activeFlags = EVENT_FLAGS.filter((f) => event[f.key])

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
        const length = Math.max(position, lastFilled)
        const next = Array.from({ length }, (_, i) => (i + 1 === position ? teamId : (byPosition.get(i + 1)?.team_id ?? null)))
        // Trailing empty positions are not sent.
        while (next.length > 0 && next[next.length - 1] === null) next.pop()
        run(() => setEventResults(code, event.id, next), 'Não foi possível salvar o resultado.')
    }

    async function save(formEvent: FormEvent<HTMLFormElement>) {
        formEvent.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        const changes: Partial<EventFlags & { name: string }> = {}
        if (trimmed !== event.name) changes.name = trimmed
        for (const flag of EVENT_FLAGS) if (flags[flag.key] !== event[flag.key]) changes[flag.key] = flags[flag.key]
        if (Object.keys(changes).length === 0) {
            setIsEditing(false)
            return
        }
        const ok = await run(() => updateEvent(code, event.id, changes), 'Não foi possível alterar a prova.')
        if (ok) setIsEditing(false)
    }

    function startEditing() {
        setName(event.name)
        setFlags({ demonstrativa: event.demonstrativa, revezamento: event.revezamento })
        setIsEditing(true)
    }

    function remove() {
        const warning = athletes > 0 ? `\nOs ${athletes} ${athletes === 1 ? 'resultado registrado será perdido' : 'resultados registrados serão perdidos'}.` : ''
        if (!window.confirm(`Remover a prova "${event.name}"?${warning}`)) return
        run(() => deleteEvent(code, event.id), 'Não foi possível remover a prova.')
    }

    function toggleFinished() {
        run(() => updateEvent(code, event.id, { finished: !event.finished }), 'Não foi possível alterar a prova.')
    }

    function pointsText(entry: EventEntry | null): { text: string; title: string; muted: boolean } {
        if (!entry) return { text: '', title: '', muted: true }
        if (!event.finished) return { text: '–', title: 'Pontua ao encerrar a prova', muted: true }
        if (!entry.scores) return { text: '–', title: 'Segundo atleta do time: não pontua nem ocupa lugar', muted: true }
        if (event.demonstrativa) return { text: '–', title: 'Demonstrativa: não pontua', muted: true }
        return { text: String(entry.points ?? 0), title: `${entry.place}º entre ${teamsIn} ${teamsIn === 1 ? 'time' : 'times'}`, muted: (entry.points ?? 0) === 0 }
    }

    return (
        <article className={`flex flex-col rounded-2xl border bg-black/65 shadow-lg shadow-black/30 transition ${event.finished ? 'border-white/10' : 'border-red-950/60'} ${isBusy ? 'opacity-60' : ''}`}>
            <header className="flex flex-wrap items-start gap-2 border-b border-white/10 px-4 py-3">
                {isEditing ? (
                    <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={save}>
                        <input className={`${INPUT_CLASS} min-w-0 flex-1 basis-40`} value={name} required autoFocus disabled={isBusy} aria-label="Nome da prova" onChange={(e) => setName(e.target.value)} />
                        <EventFlagsFields value={flags} disabled={isBusy} onChange={setFlags} />
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
                                {activeFlags.map((flag) => (
                                    <span key={flag.key} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${FLAG_BADGE[flag.key]}`} title={flag.hint}>
                                        {flag.label}
                                    </span>
                                ))}
                            </h4>
                            <p className="text-xs text-zinc-500">
                                {event.finished ? 'Encerrada' : 'Em andamento'} · {athletes} {athletes === 1 ? 'atleta' : 'atletas'} de {teamsIn} {teamsIn === 1 ? 'time' : 'times'} · até {perTeam} por time
                                {activeFlags.map((flag) => ` · ${flag.hint.toLowerCase()}`).join('')}
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
            ) : positions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma colocação registrada.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            <th scope="col" className="w-10 whitespace-nowrap px-3 py-2 text-right">#</th>
                            <th scope="col" className="w-full px-2 py-2 text-left">Time</th>
                            <th scope="col" className="w-14 whitespace-nowrap px-3 py-2 text-right" title="Pontos pela tabela do número de times na prova, ao encerrar">Pts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((position) => {
                            const entry = byPosition.get(position) ?? null
                            const team = entry ? (teamById.get(entry.team_id) ?? null) : null
                            const note = entryNote(entry)
                            const points = pointsText(entry)
                            const options = teams
                                .filter((t) => t.id === entry?.team_id || event.results.filter((r) => r.team_id === t.id).length < perTeam)
                                .map((t) => ({ value: t.id, label: t.name, icon: <TeamLogo name={t.name} className="h-5 w-5" /> }))
                            return (
                                <tr key={position} className="border-t border-white/5">
                                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-zinc-500">{position}º</td>
                                    <td className="px-2 py-1.5">
                                        <span className="flex items-center gap-1">
                                            {canFill ? (
                                                <>
                                                    <Select value={entry?.team_id ?? ''} options={options} onChange={(id) => place(position, id)} placeholder="—" className="py-1.5" />
                                                    {entry ? (
                                                        <button type="button" className={`${GHOST_BUTTON} shrink-0`} disabled={isBusy} aria-label={`Limpar ${position}º lugar`} title="Limpar" onClick={() => place(position, null)}>
                                                            ×
                                                        </button>
                                                    ) : null}
                                                </>
                                            ) : team ? (
                                                <span className="flex min-w-0 items-center gap-2 text-zinc-100">
                                                    <TeamLogo name={team.name} className="h-5 w-5" />
                                                    <span className="truncate">{team.name}</span>
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600">—</span>
                                            )}
                                            {note ? <span className="shrink-0 text-[10px] text-zinc-500">{note}</span> : null}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-1.5 text-right tabular-nums ${points.muted ? 'text-zinc-600' : 'font-semibold text-zinc-50'}`} title={points.title}>
                                        {points.text}
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
