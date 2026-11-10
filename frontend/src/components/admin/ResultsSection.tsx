import { useEffect, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import Loading from '../Loading'
import Select from '../Select'
import { editionLabel, useEdition } from '../../contexts/edition'
import { closeEdition, getEditionResults, getTeams, reopenEdition, setEditionResults } from '../../services/competition'
import type { EditionResults, ResultEntry, Team } from '../../types/competition'

const INPUT_CLASS =
    'w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY_BUTTON =
    'rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'

/** Positions (and overall points) typed in, by organization id; "" = not ranked. */
type Draft = Record<number, { position: string, points: string }>

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para registrar resultados.'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    if (/position must be/.test(message)) return 'Use colocações a partir de 1.'
    if (/already closed/.test(message)) return 'Esta edição já está encerrada.'
    return 'Não foi possível salvar.'
}

function draftFrom(entries: ResultEntry[]): Draft {
    return Object.fromEntries(entries.map((entry) => [entry.organization.id, { position: String(entry.position), points: entry.points === null ? '' : String(entry.points) }]))
}

/**
 * The saved final results of an edition, overall and per modality. Closing the edition fills them
 * from the live standings; they can also be typed in, e.g. for old editions without brackets.
 * Mounted with `key={editionId}`.
 */
export default function ResultsSection({ editionId }: { editionId: number }) {
    const { reload } = useEdition()
    const [results, setResults] = useState<EditionResults | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [scope, setScope] = useState('overall')
    const [drafts, setDrafts] = useState<Record<string, Draft>>({})
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    useEffect(() => {
        Promise.all([getEditionResults(editionId), getTeams(editionId)])
            .then(([data, teamList]) => {
                setResults(data)
                setTeams(teamList)
            })
            .catch(() => setError('Não foi possível carregar os resultados.'))
    }, [editionId])

    const overall = scope === 'overall'
    const savedEntries = results ? (overall ? results.overall : results.modalities.find((m) => m.code === scope)?.results ?? []) : []
    const draft = drafts[scope] ?? draftFrom(savedEntries)

    function change(organizationId: number, field: 'position' | 'points', value: string) {
        setSaved(false)
        setDrafts({ ...drafts, [scope]: { ...draft, [organizationId]: { ...(draft[organizationId] ?? { position: '', points: '' }), [field]: value } } })
    }

    async function run(action: () => Promise<EditionResults>, after?: () => void) {
        setBusy(true)
        setError(null)
        setSaved(false)
        try {
            setResults(await action())
            setDrafts({})
            after?.()
            return true
        } catch (err) {
            setError(errorMessage(err))
            return false
        } finally {
            setBusy(false)
        }
    }

    function save() {
        const entries = teams
            .filter((team) => draft[team.id]?.position.trim())
            .map((team) => ({
                organizationId: team.id,
                position: Number(draft[team.id].position),
                points: overall && draft[team.id].points.trim() ? Number(draft[team.id].points) : null,
            }))
        void run(() => setEditionResults(editionId, scope, entries), () => setSaved(true))
    }

    const rankedFirst = [...teams].sort((a, b) => {
        const pa = Number(draft[a.id]?.position) || Infinity
        const pb = Number(draft[b.id]?.position) || Infinity
        return pa - pb || a.name.localeCompare(b.name, 'pt-BR')
    })

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Resultados finais</h2>
                    <p className="max-w-2xl text-sm text-zinc-400">
                        A classificação que fica no histórico de campeões. Ao encerrar a edição, a pontuação atual é salva aqui; você também pode digitar as colocações, por exemplo de edições antigas sem chaveamento. Empates
                        repetem a colocação.
                    </p>
                </div>
                {results ? (
                    results.edition.finished ? (
                        <button type="button" disabled={busy} onClick={() => void run(() => reopenEdition(editionId), () => void reload())} className={SECONDARY_BUTTON}>Reabrir edição</button>
                    ) : (
                        <button type="button" disabled={busy} onClick={() => setConfirmClose(true)} className={PRIMARY_BUTTON}>Encerrar edição</button>
                    )
                ) : null}
            </div>

            {error ? <p className="mb-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {results === null && !error ? <Loading /> : null}

            {results ? (
                <div className="space-y-4">
                    <div className="w-72">
                        <Select
                            value={scope}
                            options={[
                                { value: 'overall', label: 'Classificação geral' },
                                ...results.modalities.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}${m.results.length > 0 ? ' ✓' : ''}` })),
                            ]}
                            onChange={(value) => {
                                setScope(value)
                                setSaved(false)
                            }}
                        />
                    </div>

                    {teams.length === 0 ? <p className="text-sm text-zinc-500">Adicione os times da edição para registrar a classificação.</p> : null}
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {rankedFirst.map((team) => (
                            <li key={team.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-1.5">
                                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{team.name}</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={draft[team.id]?.position ?? ''}
                                    onChange={(event) => change(team.id, 'position', event.target.value)}
                                    placeholder="—"
                                    aria-label={`Colocação de ${team.name}`}
                                    className={INPUT_CLASS}
                                />
                                <span className="text-xs text-zinc-500">º</span>
                                {overall ? (
                                    <input
                                        type="number"
                                        value={draft[team.id]?.points ?? ''}
                                        onChange={(event) => change(team.id, 'points', event.target.value)}
                                        placeholder="pts"
                                        aria-label={`Pontos de ${team.name}`}
                                        className={INPUT_CLASS}
                                    />
                                ) : null}
                            </li>
                        ))}
                    </ul>

                    {teams.length > 0 ? (
                        <div className="flex items-center justify-end gap-3">
                            {saved ? <span className="text-sm text-emerald-300">Classificação salva.</span> : null}
                            <button type="button" disabled={busy || drafts[scope] === undefined} onClick={save} className={PRIMARY_BUTTON}>Salvar classificação</button>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {confirmClose && results ? (
                <ConfirmDialog
                    title="Encerrar edição"
                    confirmLabel="Encerrar"
                    busy={busy}
                    onCancel={() => !busy && setConfirmClose(false)}
                    onConfirm={() => void run(() => closeEdition(editionId), () => void reload()).then(() => setConfirmClose(false))}
                >
                    <p>
                        A pontuação atual da <strong className="text-zinc-100">{editionLabel(results.edition)}</strong> vira o resultado final: classificação geral e colocações já
                        definidas em cada modalidade. O que já estava salvo aqui é substituído. Depois você pode corrigir à mão ou reabrir a edição.
                    </p>
                </ConfirmDialog>
            ) : null}
        </section>
    )
}
