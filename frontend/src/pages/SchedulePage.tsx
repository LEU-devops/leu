import { useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading'
import EditionSelect from '../components/EditionSelect'
import { useEdition } from '../contexts/edition'
import ScheduleGrid from '../components/schedule/ScheduleGrid'
import { buildColumns, buildDays, isPlaceable } from '../components/schedule/layout'
import { getMatches, getTimeSlots, getVenues } from '../services/competition'
import type { ScheduledMatch, TimeSlot, Venue } from '../types/competition'

export default function SchedulePage() {
    const [matches, setMatches] = useState<ScheduledMatch[] | null>(null)
    const [venues, setVenues] = useState<Venue[]>([])
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
    const [error, setError] = useState<string | null>(null)
    const { edition } = useEdition()

    useEffect(() => {
        if (!edition)
            return
        let cancelled = false
        Promise.all([getMatches(edition.id), getVenues(), getTimeSlots(edition.id)])
            .then(([allMatches, allVenues, allSlots]) => {
                if (cancelled) return
                setMatches(allMatches)
                setVenues(allVenues)
                setTimeSlots(allSlots)
            })
            .catch(() => {
                if (!cancelled) setError('Não foi possível carregar a tabela de jogos.')
            })
        return () => {
            cancelled = true
        }
    }, [edition])

    const columns = useMemo(() => buildColumns(venues, matches ?? []), [venues, matches])
    const days = useMemo(() => buildDays(matches ?? [], columns, timeSlots), [matches, columns, timeSlots])
    const pending = matches ? matches.filter((m) => !isPlaceable(m)).length : 0

    return (
        <main className="flex-1 space-y-8 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Programação</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Tabela de jogos</h1>
                <EditionSelect className="mt-3 w-56" />
            </div>

            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {matches === null && !error ? <Loading /> : null}

            {matches && days.length === 0 ? <p className="text-sm text-zinc-400">Nenhum jogo com data e local definidos.</p> : null}

            {days.map((day) => (
                <ScheduleGrid key={day.key} day={day} columns={columns} />
            ))}

            {pending > 0 ? (
                <p className="text-xs text-zinc-500">
                    {pending === 1 ? '1 jogo ainda sem data ou local definidos.' : `${pending} jogos ainda sem data ou local definidos.`}
                </p>
            ) : null}
        </main>
    )
}
