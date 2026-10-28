import { useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading'
import VenuesSection from '../components/admin/VenuesSection'
import { createTimeSlot, deleteTimeSlot, getTimeSlots } from '../services/competition'
import type { TimeSlot } from '../types/competition'

const SLOT_MINUTES = 90

const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 disabled:opacity-50 [color-scheme:dark]'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'

const dayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

function pad(n: number): string {
    return String(n).padStart(2, '0')
}

/** Local "YYYY-MM-DD" and "HH:MM" of a date, matching the native inputs. */
function splitLocal(date: Date): { date: string; time: string } {
    return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    }
}

function errorMessage(error: unknown, fallback: string): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para gerenciar horários.'
    if (text.includes('status: 409')) return 'Esse horário já está cadastrado.'
    const match = text.match(/"message":"([^"]+)"/)
    return match ? match[1] : fallback
}

interface DayGroup {
    key: string
    label: string
    slots: TimeSlot[]
}

function groupByDay(slots: TimeSlot[]): DayGroup[] {
    const groups = new Map<string, DayGroup>()
    for (const slot of slots) {
        const date = new Date(slot.starts_at)
        const key = splitLocal(date).date
        const group = groups.get(key) ?? { key, label: dayFormat.format(date), slots: [] }
        group.slots.push(slot)
        groups.set(key, group)
    }
    return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function TimeSlotsSection() {
    const [slots, setSlots] = useState<TimeSlot[] | null>(null)
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)

    useEffect(() => {
        getTimeSlots()
            .then(setSlots)
            .catch(() => setError('Não foi possível carregar os horários.'))
    }, [])

    const days = useMemo(() => groupByDay(slots ?? []), [slots])

    async function add(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!date || !time) return
        const startsAt = new Date(`${date}T${time}`)
        setError(null)
        setIsSaving(true)
        try {
            const created = await createTimeSlot(startsAt.toISOString())
            setSlots((current) => [...(current ?? []), created].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
            // Keep the day and move on to the next slot, so a whole day can be typed in a row.
            setTime(splitLocal(new Date(startsAt.getTime() + SLOT_MINUTES * 60_000)).time)
        } catch (submitError) {
            setError(errorMessage(submitError, 'Não foi possível adicionar o horário.'))
        } finally {
            setIsSaving(false)
        }
    }

    async function remove(slot: TimeSlot) {
        setError(null)
        setDeletingId(slot.id)
        try {
            await deleteTimeSlot(slot.id)
            setSlots((current) => (current ?? []).filter((s) => s.id !== slot.id))
        } catch (submitError) {
            setError(errorMessage(submitError, 'Não foi possível remover o horário.'))
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Horários base</h2>
                <p className="text-sm text-zinc-400">
                    Horários de referência do evento. Eles aparecem como opções ao agendar uma partida e como linhas na tabela de jogos.
                </p>
            </div>

            <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Dia
                    <input type="date" className={INPUT_CLASS} value={date} required onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Hora
                    <input type="time" className={`${INPUT_CLASS} w-28`} value={time} required onChange={(e) => setTime(e.target.value)} />
                </label>
                <button type="submit" className={PRIMARY_BUTTON} disabled={isSaving || !date || !time}>
                    {isSaving ? 'Adicionando...' : 'Adicionar'}
                </button>
            </form>

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <div className="mt-6 space-y-4">
                {slots === null && !error ? <Loading /> : null}
                {slots?.length === 0 ? <p className="text-sm text-zinc-500">Nenhum horário cadastrado.</p> : null}

                {days.map((day) => (
                    <div key={day.key}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{day.label}</p>
                        <ul className="flex flex-wrap gap-2">
                            {day.slots.map((slot) => (
                                <li key={slot.id} className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm">
                                    <span className="px-3 py-1.5 tabular-nums text-zinc-100">{timeFormat.format(new Date(slot.starts_at))}</span>
                                    <button
                                        type="button"
                                        onClick={() => remove(slot)}
                                        disabled={deletingId === slot.id}
                                        aria-label={`Remover ${timeFormat.format(new Date(slot.starts_at))}`}
                                        className="border-l border-white/10 px-2 py-1.5 text-zinc-500 transition hover:bg-red-950/60 hover:text-red-200 disabled:opacity-50"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default function AdminPage() {
    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Administração</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Admin</h1>
            </div>

            <TimeSlotsSection />
            <VenuesSection />
        </main>
    )
}
