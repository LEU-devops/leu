import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import Select from './Select'
import { UserAvatar, UserSearch } from './UserSearch'
import type { Period } from '../types/sports'
import type { UserSearchResult } from '../types/organizations'
import { isCurrent, periodDates, periodYears, todayIso } from '../utils/periods'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 [color-scheme:dark] disabled:opacity-40'
const SMALL_BUTTON = 'rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-40'

export interface HistoryRow extends Period {
    id: number
    email: string
    name: string
    profile_photo_url: string | null
    /** Role as shown, e.g. "Diretor(a) de Eventos" or "DM". */
    label: string
}

export interface NewPeriod extends Period {
    email: string
    role: string
    director_area: string | null
}

/** Start date plus either an end date or "current". */
function PeriodFields({ value, onChange }: { value: Period, onChange: (value: Period) => void }) {
    const max = todayIso()
    return (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Início</span>
                <input type="date" max={max} value={value.started_on} onChange={(event) => onChange({ ...value, started_on: event.target.value })} className={INPUT_CLASS} />
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Fim</span>
                <input
                    type="date"
                    min={value.started_on || undefined}
                    max={max}
                    value={value.ended_on ?? ''}
                    disabled={value.ended_on === null}
                    onChange={(event) => onChange({ ...value, ended_on: event.target.value })}
                    className={INPUT_CLASS}
                />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
                <input
                    type="checkbox"
                    checked={value.ended_on === null}
                    onChange={(event) => onChange({ ...value, ended_on: event.target.checked ? null : (value.started_on || max) })}
                    className="accent-red-600"
                />
                Atual
            </label>
        </div>
    )
}

function isValidPeriod(period: Period): boolean {
    return Boolean(period.started_on) && (period.ended_on === null || (Boolean(period.ended_on) && period.ended_on >= period.started_on))
}

interface Props {
    rows: HistoryRow[]
    canEdit: boolean
    /** Role choices for new periods; `needsArea` asks for a directorate (organization directors). */
    roleOptions: { value: string, label: string }[]
    needsArea?: (role: string) => boolean
    areaSuggestions?: string[]
    onCreate: (period: NewPeriod) => Promise<void>
    onUpdate: (id: number, period: Period) => Promise<void>
    onDelete: (id: number) => Promise<void>
    errorMessage: (error: unknown) => string
}

/**
 * Every period of a role history (organization positions or a team's athletes and DMs). Years are
 * shown, full dates are edited. Each change is saved right away.
 */
export default function PeriodHistory({ rows, canEdit, roleOptions, needsArea, areaSuggestions = [], onCreate, onUpdate, onDelete, errorMessage }: Props) {
    const [editing, setEditing] = useState<{ id: number, period: Period } | null>(null)
    const [toDelete, setToDelete] = useState<HistoryRow | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [adding, setAdding] = useState(false)
    const [user, setUser] = useState<UserSearchResult | null>(null)
    const [role, setRole] = useState(roleOptions[0]?.value ?? '')
    const [area, setArea] = useState('')
    const [period, setPeriod] = useState<Period>({ started_on: '', ended_on: '' })

    async function run(action: () => Promise<void>) {
        setBusy(true)
        setError(null)
        try {
            await action()
            return true
        } catch (err) {
            setError(errorMessage(err))
            return false
        } finally {
            setBusy(false)
        }
    }

    const areaNeeded = needsArea?.(role) ?? false
    const canAdd = user !== null && isValidPeriod(period) && (!areaNeeded || area.trim().length > 0)

    async function submitNew() {
        if (!user || !canAdd)
            return
        const ok = await run(() => onCreate({ email: user.email, role, director_area: areaNeeded ? area.trim() : null, ...period }))
        if (ok) {
            setUser(null)
            setArea('')
            setPeriod({ started_on: '', ended_on: '' })
            setAdding(false)
        }
    }

    return (
        <div className="space-y-3">
            {error ? <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p> : null}

            {canEdit ? (
                adding ? (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Adicionar período</p>
                        {user ? (
                            <div className="flex items-center gap-3">
                                <UserAvatar name={user.name} photo={user.profile_photo_url} />
                                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{user.full_name || user.name}</span>
                                <button type="button" onClick={() => setUser(null)} className="text-xs text-zinc-400 hover:text-zinc-200">Trocar</button>
                            </div>
                        ) : (
                            <UserSearch isTaken={() => false} onPick={setUser} />
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs text-zinc-400">Função</span>
                                <Select value={role} options={roleOptions} onChange={setRole} />
                            </label>
                            {areaNeeded ? (
                                <label className="block space-y-1">
                                    <span className="text-xs text-zinc-400">Diretoria</span>
                                    <input list="history-areas" value={area} onChange={(event) => setArea(event.target.value)} className={INPUT_CLASS} />
                                    <datalist id="history-areas">{areaSuggestions.map((item) => <option key={item} value={item} />)}</datalist>
                                </label>
                            ) : null}
                        </div>
                        <PeriodFields value={period} onChange={setPeriod} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setAdding(false)} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Cancelar</button>
                            <button type="button" disabled={!canAdd || busy} onClick={() => void submitNew()} className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}>
                                Adicionar
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="button" onClick={() => setAdding(true)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5">
                        + Adicionar período antigo
                    </button>
                )
            ) : null}

            {rows.length === 0 ? <p className="text-sm text-zinc-500">Nenhum período registrado.</p> : null}
            <ul className="space-y-2">
                {rows.map((row) => {
                    const isEditing = editing?.id === row.id
                    return (
                        <li key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <UserAvatar name={row.name} photo={row.profile_photo_url} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-zinc-100">{row.name}</span>
                                    <span className="block truncate text-xs text-zinc-400">{row.label}</span>
                                </span>
                                <span className={`text-xs tabular-nums ${isCurrent(row) ? 'text-emerald-300' : 'text-zinc-500'}`} title={periodDates(row)}>
                                    {periodYears(row)}
                                </span>
                                {canEdit && !isEditing ? (
                                    <span className="flex gap-1">
                                        <button type="button" onClick={() => setEditing({ id: row.id, period: { started_on: row.started_on, ended_on: row.ended_on } })} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>
                                            Editar datas
                                        </button>
                                        <button type="button" onClick={() => setToDelete(row)} className={`${SMALL_BUTTON} text-red-300 hover:bg-red-950/50`}>Excluir</button>
                                    </span>
                                ) : null}
                            </div>
                            {isEditing && editing ? (
                                <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                                    <PeriodFields value={editing.period} onChange={(next) => setEditing({ id: row.id, period: next })} />
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setEditing(null)} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Cancelar</button>
                                        <button
                                            type="button"
                                            disabled={busy || !isValidPeriod(editing.period)}
                                            onClick={() => void run(() => onUpdate(row.id, editing.period)).then((ok) => ok && setEditing(null))}
                                            className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </li>
                    )
                })}
            </ul>

            {toDelete ? (
                <ConfirmDialog
                    title="Excluir período"
                    confirmLabel="Excluir"
                    danger
                    busy={busy}
                    onCancel={() => !busy && setToDelete(null)}
                    onConfirm={() => void run(() => onDelete(toDelete.id)).then(() => setToDelete(null))}
                >
                    <p>
                        O período de <strong className="text-zinc-100">{toDelete.name}</strong> como {toDelete.label} ({periodDates(toDelete)}) será apagado do histórico.
                    </p>
                    <p className="mt-3">Use isso para corrigir registros errados. Para alguém que saiu, edite as datas e informe o fim.</p>
                </ConfirmDialog>
            ) : null}
        </div>
    )
}
