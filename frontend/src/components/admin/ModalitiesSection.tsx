import { useEffect, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import Loading from '../Loading'
import Select from '../Select'
import { addModalityToEdition, createModality, deleteModality, getModalityCatalog, removeModalityFromEdition } from '../../services/competition'
import type { CatalogModality, ModalityType } from '../../types/competition'

const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'

const TYPE_OPTIONS: { value: ModalityType, label: string }[] = [
    { value: 'chaveamento', label: 'Chaveamento' },
    { value: 'atletismo', label: 'Atletismo (provas)' },
    { value: 'natacao', label: 'Natação (provas)' },
]

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para gerenciar modalidades.'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    if (/already exists/.test(message)) return 'Já existe uma modalidade com esse código.'
    if (/in this edition/.test(message)) return 'Esta modalidade já tem chave, inscrições, provas ou participações nesta edição e não pode sair dela.'
    if (/already has a bracket/.test(message)) return 'Esta modalidade já foi disputada em alguma edição e não pode ser excluída.'
    if (/code must have/.test(message)) return 'O código deve ter 2 ou 3 letras.'
    return 'Não foi possível salvar.'
}

function byName(a: CatalogModality, b: CatalogModality): number {
    return a.name.localeCompare(b.name, 'pt-BR')
}

/**
 * The modality catalog, shared by every edition, and which of its modalities the edition has: each
 * chip toggles the modality in the edition. Mounted with `key={editionId}`.
 */
export default function ModalitiesSection({ editionId }: { editionId: number }) {
    const [catalog, setCatalog] = useState<CatalogModality[] | null>(null)
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [type, setType] = useState<ModalityType>('chaveamento')
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [toDelete, setToDelete] = useState<CatalogModality | null>(null)

    useEffect(() => {
        getModalityCatalog().then(setCatalog).catch(() => setError('Não foi possível carregar as modalidades.'))
    }, [])

    const inEdition = (modality: CatalogModality) => modality.edition_ids.includes(editionId)
    const count = catalog?.filter(inEdition).length ?? 0

    function replace(updated: CatalogModality) {
        setCatalog((list) => (list ?? []).map((m) => (m.code === updated.code ? updated : m)))
    }

    async function run(key: string, action: () => Promise<void>) {
        setBusy(key)
        setError(null)
        try {
            await action()
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setBusy(null)
        }
    }

    function toggle(modality: CatalogModality) {
        void run(modality.code, async () => {
            if (inEdition(modality)) {
                await removeModalityFromEdition(editionId, modality.code)
                replace({ ...modality, edition_ids: modality.edition_ids.filter((id) => id !== editionId) })
            } else {
                await addModalityToEdition(editionId, modality.code)
                replace({ ...modality, edition_ids: [...modality.edition_ids, editionId] })
            }
        })
    }

    function add(event: React.FormEvent) {
        event.preventDefault()
        void run('new', async () => {
            const created = await createModality({ code: code.trim().toUpperCase(), name: name.trim(), type, editionIds: [editionId] })
            setCatalog((list) => [...(list ?? []), created].sort(byName))
            setCode('')
            setName('')
        })
    }

    function remove() {
        if (!toDelete)
            return
        const modality = toDelete
        void run(modality.code, async () => {
            await deleteModality(modality.code)
            setCatalog((list) => (list ?? []).filter((m) => m.code !== modality.code))
        }).finally(() => setToDelete(null))
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Modalidades</h2>
                <p className="text-sm text-zinc-400">
                    As modalidades são as mesmas em todas as edições. Clique numa modalidade para incluí-la nesta edição ou tirá-la; só sai da edição a modalidade
                    que ainda não tem chave, inscrições ou provas nela.
                </p>
            </div>

            <form onSubmit={add} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Código
                    <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={3} placeholder="FM" className={`${INPUT_CLASS} w-20 uppercase`} required />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Nome
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Futsal Masculino" className={`${INPUT_CLASS} w-56`} required />
                </label>
                <label className="flex w-52 flex-col gap-1 text-xs font-medium text-zinc-400">
                    Tipo
                    <Select value={type} options={TYPE_OPTIONS} onChange={setType} />
                </label>
                <button type="submit" disabled={busy !== null || code.trim().length < 2 || !name.trim()} className={PRIMARY_BUTTON}>Nova modalidade</button>
            </form>

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <div className="mt-5 space-y-3">
                {catalog === null && !error ? <Loading /> : null}
                {catalog?.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma modalidade cadastrada.</p> : null}
                {catalog && catalog.length > 0 ? (
                    <p className="text-xs text-zinc-500">{count} de {catalog.length} modalidades nesta edição.</p>
                ) : null}
                <ul className="flex flex-wrap gap-2">
                    {catalog?.map((modality) => {
                        const active = inEdition(modality)
                        return (
                            <li
                                key={modality.code}
                                className={`flex items-center overflow-hidden rounded-xl border text-sm transition ${
                                    active ? 'border-red-700/60 bg-red-950/40' : 'border-dashed border-white/15 bg-transparent opacity-60 hover:opacity-100'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(modality)}
                                    disabled={busy !== null}
                                    aria-pressed={active}
                                    title={active ? 'Tirar desta edição' : 'Incluir nesta edição'}
                                    className="flex items-center disabled:cursor-wait"
                                >
                                    <span className="flex items-center gap-1.5 border-r border-white/10 px-2 py-1.5 text-xs font-bold tracking-wider text-zinc-300">
                                        <span aria-hidden className={active ? 'text-red-400' : 'text-zinc-600'}>{active ? '✓' : '+'}</span>
                                        {modality.code}
                                    </span>
                                    <span className={`px-3 py-1.5 ${active ? 'text-zinc-100' : 'text-zinc-400'}`}>{modality.name}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setToDelete(modality)}
                                    disabled={busy !== null}
                                    aria-label={`Excluir ${modality.name} de todas as edições`}
                                    title="Excluir de todas as edições"
                                    className="border-l border-white/10 px-2 py-1.5 text-zinc-500 transition hover:bg-red-950/60 hover:text-red-200"
                                >
                                    ×
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>

            {toDelete ? (
                <ConfirmDialog title="Excluir modalidade" confirmLabel="Excluir" danger busy={busy !== null} onCancel={() => busy === null && setToDelete(null)} onConfirm={remove}>
                    <p>
                        A modalidade <strong className="text-zinc-100">{toDelete.name}</strong> será excluída de <strong className="text-zinc-100">todas as edições</strong>.
                        Só é possível se ela nunca tiver sido disputada (sem chave, inscrições, provas ou participações). Para tirá-la só desta edição, clique nela.
                    </p>
                </ConfirmDialog>
            ) : null}
        </section>
    )
}
