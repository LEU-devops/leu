import { useEffect, useState } from 'react'
import { Navigate, NavLink, useParams } from 'react-router-dom'
import EventCard from '../components/events/EventCard'
import EventsStandingsTable from '../components/events/EventsStandingsTable'
import NewEventForm from '../components/events/NewEventForm'
import RegistrationsSection from '../components/events/RegistrationsSection'
import Loading from '../components/Loading'
import { getToken } from '../services/auth'
import { getEventsView, getModalities, getTeams, type EventsView } from '../services/competition'
import type { EventsModalityType, Modality, Team } from '../types/competition'

const TITLES: Record<EventsModalityType, string> = { atletismo: 'Atletismo', natacao: 'Natação' }

/** Mounted with `key={modality.code}`, so every state below starts fresh when the modality changes. */
function ModalityEvents({ modality, canEdit }: { modality: Modality; canEdit: boolean }) {
    const [view, setView] = useState<EventsView | null>(null)
    const [allTeams, setAllTeams] = useState<Team[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        Promise.all([getEventsView(modality.code), getTeams()])
            .then(([data, teams]) => {
                if (cancelled) return
                setView(data)
                setAllTeams(teams)
            })
            .catch(() => {
                if (!cancelled) setError('Não foi possível carregar as provas.')
            })
        return () => {
            cancelled = true
        }
    }, [modality.code])

    if (error) return <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
    if (view === null) return <Loading />

    const finishedCount = view.events.filter((e) => e.finished).length
    const summary = [
        `${view.teams.length} ${view.teams.length === 1 ? 'inscrito' : 'inscritos'}`,
        `${view.events.length} ${view.events.length === 1 ? 'prova' : 'provas'}`,
        view.events.length > 0 ? `${finishedCount} ${finishedCount === 1 ? 'encerrada' : 'encerradas'}` : null,
    ].filter(Boolean).join(' · ')

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{modality.code}</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">{modality.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{summary}</p>
            </div>

            <RegistrationsSection code={modality.code} registered={view.teams} allTeams={allTeams} canEdit={canEdit} onChange={setView} />

            <section className="space-y-3">
                <div>
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Classificação</h3>
                    <p className="text-sm text-zinc-400">
                        Soma dos pontos de cada prova. A colocação final aqui é o que pontua na tabela geral; enquanto houver provas abertas, a tabela mostra as faixas possíveis.
                    </p>
                </div>
                {view.error ? <p className="rounded-2xl border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{view.error}</p> : null}
                {view.teams.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nenhum time inscrito.</p>
                ) : view.standings ? (
                    <EventsStandingsTable teams={view.teams} events={view.events} standings={view.standings} />
                ) : null}
            </section>

            <section className="space-y-3">
                <div>
                    <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Provas</h3>
                    <p className="text-sm text-zinc-400">
                        Uma tabela por prova com o time de cada colocação. Revezamentos pontuam em dobro e demonstrativas não pontuam.
                    </p>
                </div>

                {canEdit ? <NewEventForm code={modality.code} onChange={setView} /> : null}

                {view.events.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nenhuma prova cadastrada.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {view.events.map((event) => (
                            <EventCard key={event.id} code={modality.code} event={event} teams={view.teams} canEdit={canEdit} onChange={setView} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

interface Props {
    type: EventsModalityType
}

/** Page of one events sport (atletismo or natação): its modalities as tabs, each with registrations, standings and events. */
export default function EventsPage({ type }: Props) {
    const { code } = useParams()
    const [modalities, setModalities] = useState<Modality[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const canEdit = Boolean(getToken())
    const title = TITLES[type]

    useEffect(() => {
        getModalities()
            .then((all) => setModalities(all.filter((m) => m.type === type)))
            .catch(() => setError('Não foi possível carregar as modalidades.'))
    }, [type])

    const selected = modalities?.find((m) => m.code === code?.toUpperCase()) ?? null

    // No modality in the URL: open the first one.
    if (modalities && modalities.length > 0 && !code) return <Navigate to={`/${type}/${modalities[0].code}`} replace />

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Provas</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
            </div>

            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {modalities === null && !error ? <Loading /> : null}

            {modalities && modalities.length === 0 ? (
                <p className="text-sm text-zinc-400">
                    Nenhuma modalidade de {title.toLowerCase()} cadastrada. Cadastre uma modalidade com tipo <code className="rounded bg-white/10 px-1">{type}</code> (ex.: "{title} Masculino").
                </p>
            ) : null}

            {modalities && modalities.length > 1 ? (
                <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label={`Modalidades de ${title.toLowerCase()}`}>
                    {modalities.map((modality) => (
                        <NavLink
                            key={modality.code}
                            to={`/${type}/${modality.code}`}
                            className={({ isActive }) =>
                                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-red-950/50 text-zinc-50' : 'text-zinc-300 hover:bg-white/5'}`
                            }
                        >
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] font-bold tracking-wider">{modality.code}</span>
                            <span className="whitespace-nowrap">{modality.name}</span>
                        </NavLink>
                    ))}
                </nav>
            ) : null}

            {selected ? (
                <ModalityEvents key={selected.code} modality={selected} canEdit={canEdit} />
            ) : modalities && modalities.length > 0 && code ? (
                <p className="text-sm text-zinc-400">Modalidade não encontrada.</p>
            ) : null}
        </main>
    )
}
