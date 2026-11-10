import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Loading from '../components/Loading'
import Select from '../components/Select'
import Podium from '../components/results/Podium'
import { editionLabel } from '../contexts/edition'
import { getChampions, getCups, getModalityCatalog } from '../services/competition'
import type { CatalogModality, ChampionsRow, Cup } from '../types/competition'

/** History of champions: the podium of every edition with saved results, by cup and by modality. */
export default function ChampionsPage() {
    const [params, setParams] = useSearchParams()
    const cupId = params.get('copa') ? Number(params.get('copa')) : undefined
    const modality = params.get('modalidade') ?? ''
    const [cups, setCups] = useState<Cup[]>([])
    const [catalog, setCatalog] = useState<CatalogModality[]>([])
    const [loaded, setLoaded] = useState<{ key: string, rows: ChampionsRow[] } | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([getCups(), getModalityCatalog()])
            .then(([cupList, modalities]) => {
                setCups(cupList)
                setCatalog(modalities)
            })
            .catch(() => setError('Não foi possível carregar as copas.'))
    }, [])

    const key = `${cupId}|${modality}`
    useEffect(() => {
        let cancelled = false
        getChampions({ cupId, modality: modality || undefined })
            .then((rows) => !cancelled && setLoaded({ key: `${cupId}|${modality}`, rows }))
            .catch(() => !cancelled && setError('Não foi possível carregar os campeões.'))
        return () => {
            cancelled = true
        }
    }, [cupId, modality])
    const rows = loaded?.key === key ? loaded.rows : null

    function filter(next: { copa?: number, modalidade?: string }) {
        const search = new URLSearchParams()
        const copa = 'copa' in next ? next.copa : cupId
        const modalidade = 'modalidade' in next ? next.modalidade : modality
        if (copa !== undefined) search.set('copa', String(copa))
        if (modalidade) search.set('modalidade', modalidade)
        setParams(search, { replace: true })
    }

    const titles = new Map<string, { name: string, count: number }>()
    for (const row of rows ?? []) {
        for (const entry of row.podium.filter((item) => item.position === 1)) {
            const current = titles.get(entry.organization.name) ?? { name: entry.name, count: 0 }
            titles.set(entry.organization.name, { ...current, count: current.count + 1 })
        }
    }
    const ranking = [...titles.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
    const chip = (active: boolean) => `rounded-full px-4 py-1.5 text-sm transition ${active ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Histórico</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Campeões</h1>
                <p className="mt-1 text-sm text-zinc-400">Pódio de cada edição encerrada ou registrada, geral ou por modalidade.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => filter({ copa: undefined })} className={chip(cupId === undefined)}>Todas as copas</button>
                {cups.map((cup) => (
                    <button key={cup.id} type="button" onClick={() => filter({ copa: cup.id })} className={chip(cupId === cup.id)}>{cup.name}</button>
                ))}
                <div className="w-64 sm:ml-auto">
                    <Select
                        value={modality || 'geral'}
                        options={[{ value: 'geral', label: 'Classificação geral' }, ...catalog.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }))]}
                        onChange={(value) => filter({ modalidade: value === 'geral' ? '' : value })}
                    />
                </div>
            </div>

            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {rows === null && !error ? <Loading /> : null}
            {rows?.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">Nenhum resultado registrado para este filtro.</p> : null}

            {ranking.length > 0 ? (
                <section className="flex flex-wrap gap-2 text-sm">
                    <span className="text-zinc-500">Títulos:</span>
                    {ranking.map((item) => (
                        <span key={item.name} className="rounded-full border border-amber-400/30 bg-amber-950/20 px-3 py-0.5 text-amber-200">
                            {item.name} <span className="font-semibold">{item.count}×</span>
                        </span>
                    ))}
                </section>
            ) : null}

            <ul className="space-y-3">
                {rows?.map((row) => (
                    <li key={row.edition.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 sm:flex-row sm:items-center">
                        <div className="sm:w-56">
                            <p className="font-semibold text-zinc-100">{editionLabel(row.edition)}</p>
                            {row.edition.custom_name ? <p className="text-xs text-zinc-500">{row.edition.cup_name}</p> : null}
                        </div>
                        <Podium entries={row.podium} />
                    </li>
                ))}
            </ul>
        </main>
    )
}
