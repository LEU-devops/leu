import { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import BracketBuilder from '../components/bracket/BracketBuilder'
import BracketView from '../components/bracket/BracketView'
import Loading from '../components/Loading'
import { getBracket, getModalities, getTeams, getVenues } from '../services/competition'
import type { BracketMatch, Modality, Team, Venue } from '../types/competition'

/** Mounted with `key={modality.code}`, so every state below starts fresh when the modality changes. */
function ModalityContent({ modality }: { modality: Modality }) {
    const [matches, setMatches] = useState<BracketMatch[] | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [venues, setVenues] = useState<Venue[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (modality.type !== 'chaveamento') return
        let cancelled = false

        Promise.all([getBracket(modality.code), getTeams(), getVenues()])
            .then(([bracket, allTeams, allVenues]) => {
                if (cancelled) return
                setMatches(bracket)
                setTeams(allTeams)
                setVenues(allVenues)
            })
            .catch(() => {
                if (!cancelled) setError('Não foi possível carregar o chaveamento.')
            })

        return () => {
            cancelled = true
        }
    }, [modality.code, modality.type])

    if (modality.type !== 'chaveamento')
        return <p className="text-sm text-zinc-400">Esta modalidade é disputada em fase única e não possui chaveamento.</p>

    if (error) return <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
    if (matches === null) return <Loading />

    if (matches.length === 0)
        return <BracketBuilder key={modality.code} code={modality.code} teams={teams} onCreated={setMatches} />

    return <BracketView matches={matches} venues={venues} onChange={setMatches} />
}

export default function BracketsPage() {
    const { code } = useParams()
    const [modalities, setModalities] = useState<Modality[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        getModalities()
            .then(setModalities)
            .catch(() => setError('Não foi possível carregar as modalidades.'))
    }, [])

    const selected = modalities?.find((m) => m.code === code?.toUpperCase()) ?? null

    return (
        <div className="relative z-10 flex min-h-screen flex-col md:flex-row">
            <aside className="shrink-0 border-b border-white/10 bg-black/65 backdrop-blur md:w-64 md:border-r md:border-b-0">
                <div className="px-5 pt-5 pb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">Leu</p>
                    <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Chaveamentos</h1>
                </div>

                {error ? <p className="px-5 pb-4 text-sm text-red-300">{error}</p> : null}
                {modalities === null && !error ? <div className="h-16"><Loading /></div> : null}

                <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
                    {modalities?.map((modality) => (
                        <NavLink
                            key={modality.code}
                            to={`/chaveamentos/${modality.code}`}
                            className={({ isActive }) =>
                                `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                    isActive ? 'bg-red-950/50 text-zinc-50' : 'text-zinc-300 hover:bg-white/5'
                                }`
                            }
                        >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold tracking-wider">
                                {modality.code}
                            </span>
                            <span className="truncate">{modality.name}</span>
                        </NavLink>
                    ))}
                    {modalities?.length === 0 ? <p className="px-3 py-2 text-sm text-zinc-500">Nenhuma modalidade cadastrada.</p> : null}
                </nav>
            </aside>

            <main className="min-w-0 flex-1 p-4 md:p-8">
                {selected ? (
                    <>
                        <div className="mb-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{selected.code}</p>
                            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">{selected.name}</h2>
                        </div>
                        <ModalityContent key={selected.code} modality={selected} />
                    </>
                ) : modalities ? (
                    <p className="text-sm text-zinc-400">
                        {code ? 'Modalidade não encontrada.' : 'Selecione uma modalidade para ver o chaveamento.'}
                    </p>
                ) : null}
            </main>
        </div>
    )
}
