import { useEffect, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import Select from '../Select'
import { editionLabel, useEdition } from '../../contexts/edition'
import { createCup, createEdition, deleteCup, deleteEdition, getCups, renameCup, updateEdition } from '../../services/competition'
import type { CopaEdition, Cup } from '../../types/competition'

const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 [color-scheme:dark]'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'
const SMALL_BUTTON = 'rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-40'

const ERRORS: [RegExp, string][] = [
    [/Cup .* already exists/, 'Já existe uma copa com esse nome.'],
    [/already has an edition in this year/, 'Essa copa já tem uma edição nesse ano.'],
    [/already has editions/, 'Esta copa já tem edições e não pode ser excluída.'],
    [/current edition cannot be deleted/, 'A edição atual não pode ser excluída. Torne outra atual antes.'],
    [/already has brackets/, 'Esta edição já tem chaves, inscrições, provas, participações ou resultados e não pode ser excluída.'],
    [/year must be/, 'Ano inválido.'],
    [/name is required/, 'Informe o nome.'],
]

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para gerenciar as copas.'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    return ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? 'Não foi possível salvar.'
}

interface EditionDraft {
    id: number
    cupId: number
    year: string
    name: string
}

/**
 * Cups (Copa Eng, Copa Bixo...) and their editions: create (copying the modalities and teams of
 * the cup's last edition), edit, make current, delete.
 */
export default function EditionsSection() {
    const { editions, reload, setEditionId } = useEdition()
    const [cups, setCups] = useState<Cup[]>([])
    const [newCup, setNewCup] = useState('')
    const [renamingCup, setRenamingCup] = useState<Cup | null>(null)
    const [cupId, setCupId] = useState<number | null>(null)
    const [year, setYear] = useState(String(new Date().getFullYear()))
    const [name, setName] = useState('')
    const [makeCurrent, setMakeCurrent] = useState(false)
    const [editing, setEditing] = useState<EditionDraft | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirm, setConfirm] = useState<{ kind: 'current' | 'delete', edition: CopaEdition } | { kind: 'cup', cup: Cup } | null>(null)

    useEffect(() => {
        getCups().then(setCups).catch(() => setError('Não foi possível carregar as copas.'))
    }, [])

    const selectedCup = cupId ?? cups[0]?.id ?? null
    const lastOfCup = editions.find((edition) => edition.cup_id === selectedCup)
    const cupOptions = cups.map((cup) => ({ value: cup.id, label: cup.name }))

    async function run(action: () => Promise<unknown>) {
        setBusy(true)
        setError(null)
        try {
            await action()
            await reload()
            return true
        } catch (err) {
            setError(errorMessage(err))
            return false
        } finally {
            setBusy(false)
        }
    }

    async function create(event: React.FormEvent) {
        event.preventDefault()
        if (selectedCup === null)
            return
        let createdId: number | null = null
        const ok = await run(async () => {
            const created = await createEdition({ cupId: selectedCup, year: Number(year), name: name.trim() || null, makeCurrent })
            createdId = created.id
        })
        if (ok && createdId !== null) {
            setEditionId(createdId)
            setName('')
        }
    }

    function confirmAction() {
        if (!confirm)
            return
        const action = confirm.kind === 'cup'
            ? () => deleteCup(confirm.cup.id).then(() => setCups((list) => list.filter((cup) => cup.id !== confirm.cup.id)))
            : confirm.kind === 'current'
                ? () => updateEdition(confirm.edition.id, { isCurrent: true })
                : () => deleteEdition(confirm.edition.id)
        void run(action).then(() => setConfirm(null))
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Copas e edições</h2>
                <p className="text-sm text-zinc-400">
                    Cada copa tem uma edição por ano. Uma edição nova começa com as modalidades e os times da última edição da mesma copa. A edição atual é a que todos veem por padrão.
                </p>
            </div>

            <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Copas</h3>
                <ul className="flex flex-wrap items-center gap-2">
                    {cups.map((cup) => (
                        <li key={cup.id} className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm">
                            {renamingCup?.id === cup.id ? (
                                <form
                                    className="flex"
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                        void run(async () => {
                                            const updated = await renameCup(cup.id, renamingCup.name.trim())
                                            setCups((list) => list.map((row) => (row.id === cup.id ? updated : row)))
                                            setRenamingCup(null)
                                        })
                                    }}
                                >
                                    <input autoFocus value={renamingCup.name} onChange={(e) => setRenamingCup({ ...renamingCup, name: e.target.value })} className="w-40 bg-transparent px-3 py-1.5 text-zinc-50 outline-none" />
                                    <button type="submit" className="px-2 text-xs text-red-300">OK</button>
                                </form>
                            ) : (
                                <button type="button" onClick={() => setRenamingCup(cup)} title="Renomear" className="px-3 py-1.5 text-zinc-100 hover:bg-white/5">{cup.name}</button>
                            )}
                            <button
                                type="button"
                                onClick={() => setConfirm({ kind: 'cup', cup })}
                                aria-label={`Excluir ${cup.name}`}
                                className="border-l border-white/10 px-2 py-1.5 text-zinc-500 transition hover:bg-red-950/60 hover:text-red-200"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                    <li>
                        <form
                            className="flex gap-1"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void run(async () => {
                                    const cup = await createCup(newCup.trim())
                                    setCups((list) => [...list, cup].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
                                    setNewCup('')
                                })
                            }}
                        >
                            <input value={newCup} onChange={(e) => setNewCup(e.target.value)} placeholder="Nova copa" maxLength={60} className={`${INPUT_CLASS} w-40 py-1.5`} />
                            <button type="submit" disabled={busy || !newCup.trim()} className={`${SMALL_BUTTON} bg-white/10 text-zinc-100 hover:bg-white/15`}>Adicionar</button>
                        </form>
                    </li>
                </ul>
            </div>

            <form onSubmit={create} className="mt-6 flex flex-wrap items-end gap-2">
                <label className="flex w-48 flex-col gap-1 text-xs font-medium text-zinc-400">
                    Copa
                    <Select value={selectedCup ?? ''} options={cupOptions} onChange={setCupId} placeholder="Crie uma copa" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Ano
                    <input type="number" min={1950} max={2100} value={year} onChange={(e) => setYear(e.target.value)} className={`${INPUT_CLASS} w-24`} required />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Nome de exibição (opcional)
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={cups.find((cup) => cup.id === selectedCup)?.name ?? ''} className={`${INPUT_CLASS} w-56`} />
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} className="accent-red-600" />
                    Tornar atual
                </label>
                <button type="submit" disabled={busy || selectedCup === null} className={PRIMARY_BUTTON}>Criar edição</button>
            </form>
            {selectedCup !== null ? (
                <p className="mt-2 text-xs text-zinc-500">
                    {lastOfCup ? `Copia modalidades e times da ${editionLabel(lastOfCup)}.` : editions.length > 0 ? `Primeira edição desta copa: copia da ${editionLabel(editions[0])}.` : 'Começa com todas as modalidades e sem times.'}
                </p>
            ) : null}

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <ul className="mt-5 space-y-2">
                {editions.map((edition) => (
                    <li key={edition.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
                        {editing?.id === edition.id ? (
                            <form
                                className="flex flex-1 flex-wrap items-center gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void run(() => updateEdition(edition.id, { cupId: editing.cupId, year: Number(editing.year), name: editing.name.trim() || null }))
                                        .then((ok) => ok && setEditing(null))
                                }}
                            >
                                <div className="w-44"><Select value={editing.cupId} options={cupOptions} onChange={(value) => setEditing({ ...editing, cupId: value })} /></div>
                                <input type="number" value={editing.year} onChange={(e) => setEditing({ ...editing, year: e.target.value })} className={`${INPUT_CLASS} w-24`} />
                                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome de exibição" maxLength={60} className={`${INPUT_CLASS} w-48`} />
                                <button type="submit" disabled={busy} className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}>Salvar</button>
                                <button type="button" onClick={() => setEditing(null)} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Cancelar</button>
                            </form>
                        ) : (
                            <>
                                <span className="flex flex-1 flex-wrap items-center gap-2 text-sm text-zinc-100">
                                    {editionLabel(edition)}
                                    {edition.custom_name ? <span className="text-xs text-zinc-500">({edition.cup_name})</span> : null}
                                    {edition.is_current ? <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[11px] text-emerald-300">atual</span> : null}
                                    {edition.finished ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-zinc-300">encerrada</span> : null}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setEditing({ id: edition.id, cupId: edition.cup_id, year: String(edition.year), name: edition.custom_name ?? '' })}
                                    className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}
                                >
                                    Editar
                                </button>
                                {!edition.is_current ? (
                                    <>
                                        <button type="button" onClick={() => setConfirm({ kind: 'current', edition })} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Tornar atual</button>
                                        <button type="button" onClick={() => setConfirm({ kind: 'delete', edition })} className={`${SMALL_BUTTON} text-red-300 hover:bg-red-950/50`}>Excluir</button>
                                    </>
                                ) : null}
                            </>
                        )}
                    </li>
                ))}
            </ul>

            {confirm ? (
                <ConfirmDialog
                    title={confirm.kind === 'current' ? 'Trocar a edição atual' : confirm.kind === 'cup' ? 'Excluir copa' : 'Excluir edição'}
                    confirmLabel={confirm.kind === 'current' ? 'Tornar atual' : 'Excluir'}
                    danger={confirm.kind !== 'current'}
                    busy={busy}
                    onCancel={() => !busy && setConfirm(null)}
                    onConfirm={confirmAction}
                >
                    {confirm.kind === 'current' ? (
                        <p>A <strong className="text-zinc-100">{editionLabel(confirm.edition)}</strong> passa a ser a edição mostrada por padrão em chaveamentos, tabela, provas e pontuação para todos.</p>
                    ) : confirm.kind === 'cup' ? (
                        <p>A copa <strong className="text-zinc-100">{confirm.cup.name}</strong> será excluída. Só é possível se ela não tiver nenhuma edição.</p>
                    ) : (
                        <p>
                            A <strong className="text-zinc-100">{editionLabel(confirm.edition)}</strong> será excluída com seus times, modalidades e horários. Só é possível se nada foi disputado
                            nem registrado nela (chaves, inscrições, provas, participações ou resultados).
                        </p>
                    )}
                </ConfirmDialog>
            ) : null}
        </section>
    )
}
