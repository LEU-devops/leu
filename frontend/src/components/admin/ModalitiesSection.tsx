import { useEffect, useState } from 'react'
import ConfirmDialog from '../ConfirmDialog'
import Loading from '../Loading'
import Select from '../Select'
import { createModality, deleteModality, getModalities } from '../../services/competition'
import type { Modality, ModalityType } from '../../types/competition'

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
    if (/already exists/.test(message)) return 'Já existe uma modalidade com esse código nesta edição.'
    if (/already has a bracket/.test(message)) return 'Esta modalidade já tem chave, inscrições ou provas e não pode ser excluída.'
    if (/code must have/.test(message)) return 'O código deve ter 2 ou 3 letras.'
    return 'Não foi possível salvar.'
}

/** Modalities of one edition. Mounted with `key={editionId}`. */
export default function ModalitiesSection({ editionId }: { editionId: number }) {
    const [modalities, setModalities] = useState<Modality[] | null>(null)
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [type, setType] = useState<ModalityType>('chaveamento')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toDelete, setToDelete] = useState<Modality | null>(null)

    useEffect(() => {
        getModalities(editionId).then(setModalities).catch(() => setError('Não foi possível carregar as modalidades.'))
    }, [editionId])

    async function add(event: React.FormEvent) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        try {
            const created = await createModality(editionId, { code: code.trim().toUpperCase(), name: name.trim(), type })
            setModalities((list) => [...(list ?? []), created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
            setCode('')
            setName('')
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!toDelete)
            return
        setBusy(true)
        setError(null)
        try {
            await deleteModality(toDelete.code)
            setModalities((list) => (list ?? []).filter((m) => m.code !== toDelete.code))
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setBusy(false)
            setToDelete(null)
        }
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Modalidades</h2>
                <p className="text-sm text-zinc-400">Modalidades desta edição. O código (ex.: FM) aparece nos chaveamentos e na pontuação.</p>
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
                <button type="submit" disabled={busy || code.trim().length < 2 || !name.trim()} className={PRIMARY_BUTTON}>Adicionar</button>
            </form>

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <div className="mt-5">
                {modalities === null && !error ? <Loading /> : null}
                {modalities?.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma modalidade nesta edição.</p> : null}
                <ul className="flex flex-wrap gap-2">
                    {modalities?.map((modality) => (
                        <li key={modality.code} className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-sm">
                            <span className="border-r border-white/10 px-2 py-1.5 text-xs font-bold tracking-wider text-zinc-300">{modality.short_code}</span>
                            <span className="px-3 py-1.5 text-zinc-100">{modality.name}</span>
                            <button
                                type="button"
                                onClick={() => setToDelete(modality)}
                                aria-label={`Excluir ${modality.name}`}
                                className="border-l border-white/10 px-2 py-1.5 text-zinc-500 transition hover:bg-red-950/60 hover:text-red-200"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {toDelete ? (
                <ConfirmDialog title="Excluir modalidade" confirmLabel="Excluir" danger busy={busy} onCancel={() => !busy && setToDelete(null)} onConfirm={() => void remove()}>
                    <p>A modalidade <strong className="text-zinc-100">{toDelete.name}</strong> será excluída desta edição. Só é possível se ela ainda não tiver chave, inscrições ou provas.</p>
                </ConfirmDialog>
            ) : null}
        </section>
    )
}
