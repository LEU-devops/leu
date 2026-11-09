import { useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import Select from '../Select'
import { editionLabel, useEdition } from '../../contexts/edition'
import { createEdition, deleteEdition, updateEdition } from '../../services/competition'
import type { CopaEdition } from '../../types/competition'

const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 [color-scheme:dark]'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'
const SMALL_BUTTON = 'rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-40'

const ERRORS: [RegExp, string][] = [
    [/already exists/, 'Já existe uma edição com esse nome e ano.'],
    [/current edition cannot be deleted/, 'A edição atual não pode ser excluída. Torne outra atual antes.'],
    [/Delete the modalities/, 'Exclua as modalidades desta edição antes.'],
    [/year must be/, 'Ano inválido.'],
    [/name is required/, 'Informe o nome.'],
]

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para gerenciar as edições.'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    return ERRORS.find(([pattern]) => pattern.test(message))?.[1] ?? 'Não foi possível salvar.'
}

/** Copa editions: create (optionally copying another edition's modalities), rename, make current, delete. */
export default function EditionsSection() {
    const { editions, reload, setEditionId } = useEdition()
    const [name, setName] = useState('Copa Eng')
    const [year, setYear] = useState(String(new Date().getFullYear()))
    const [copyFrom, setCopyFrom] = useState<number | ''>('')
    const [makeCurrent, setMakeCurrent] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [renaming, setRenaming] = useState<{ id: number, name: string, year: string } | null>(null)
    const [confirm, setConfirm] = useState<{ kind: 'current' | 'delete', edition: CopaEdition } | null>(null)

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
        let createdId: number | null = null
        const ok = await run(async () => {
            const created = await createEdition({ name: name.trim(), year: Number(year), copyModalitiesFrom: copyFrom === '' ? null : copyFrom, makeCurrent })
            createdId = created.id
        })
        if (ok && createdId !== null)
            setEditionId(createdId)
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Edições da Copa</h2>
                <p className="text-sm text-zinc-400">
                    Cada edição tem suas modalidades, chaves, provas, horários e pontuação. A edição atual é a que todos veem por padrão; as anteriores continuam acessíveis pelo seletor.
                </p>
            </div>

            <form onSubmit={create} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Nome
                    <input list="edition-names" value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT_CLASS} w-40`} required />
                    <datalist id="edition-names"><option value="Copa Eng" /><option value="Copa Bixo" /></datalist>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Ano
                    <input type="number" min={1950} max={2100} value={year} onChange={(e) => setYear(e.target.value)} className={`${INPUT_CLASS} w-24`} required />
                </label>
                <label className="flex w-64 flex-col gap-1 text-xs font-medium text-zinc-400">
                    Copiar modalidades de
                    <Select
                        value={copyFrom === '' ? 0 : copyFrom}
                        options={[{ value: 0, label: 'Nenhuma (começar vazia)' }, ...editions.map((e) => ({ value: e.id, label: editionLabel(e) }))]}
                        onChange={(value) => setCopyFrom(value === 0 ? '' : value)}
                    />
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
                    <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} className="accent-red-600" />
                    Tornar atual
                </label>
                <button type="submit" disabled={busy || !name.trim()} className={PRIMARY_BUTTON}>Criar edição</button>
            </form>

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <ul className="mt-5 space-y-2">
                {editions.map((edition) => (
                    <li key={edition.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2">
                        {renaming?.id === edition.id ? (
                            <form
                                className="flex flex-1 flex-wrap gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void run(() => updateEdition(edition.id, { name: renaming.name.trim(), year: Number(renaming.year) })).then((ok) => ok && setRenaming(null))
                                }}
                            >
                                <input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} className={`${INPUT_CLASS} w-40`} />
                                <input type="number" value={renaming.year} onChange={(e) => setRenaming({ ...renaming, year: e.target.value })} className={`${INPUT_CLASS} w-24`} />
                                <button type="submit" disabled={busy} className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}>Salvar</button>
                                <button type="button" onClick={() => setRenaming(null)} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Cancelar</button>
                            </form>
                        ) : (
                            <>
                                <span className="flex-1 text-sm text-zinc-100">
                                    {editionLabel(edition)}
                                    {edition.is_current ? <span className="ml-2 rounded-full bg-emerald-900/50 px-2 py-0.5 text-[11px] text-emerald-300">atual</span> : null}
                                </span>
                                <button type="button" onClick={() => setRenaming({ id: edition.id, name: edition.name, year: String(edition.year) })} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>
                                    Renomear
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
                    title={confirm.kind === 'current' ? 'Trocar a edição atual' : 'Excluir edição'}
                    confirmLabel={confirm.kind === 'current' ? 'Tornar atual' : 'Excluir'}
                    danger={confirm.kind === 'delete'}
                    busy={busy}
                    onCancel={() => !busy && setConfirm(null)}
                    onConfirm={() => void run(() => (confirm.kind === 'current' ? updateEdition(confirm.edition.id, { isCurrent: true }) : deleteEdition(confirm.edition.id))).then(() => setConfirm(null))}
                >
                    {confirm.kind === 'current' ? (
                        <p>A <strong className="text-zinc-100">{editionLabel(confirm.edition)}</strong> passa a ser a edição mostrada por padrão em chaveamentos, tabela, provas e pontuação para todos.</p>
                    ) : (
                        <p>A <strong className="text-zinc-100">{editionLabel(confirm.edition)}</strong> será excluída. Só é possível excluir uma edição sem modalidades.</p>
                    )}
                </ConfirmDialog>
            ) : null}
        </section>
    )
}
