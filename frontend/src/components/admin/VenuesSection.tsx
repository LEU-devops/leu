import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Loading from '../Loading'
import { createVenue, deleteVenue, getMatches, getVenues, updateVenue } from '../../services/competition'
import type { ScheduledMatch, Venue } from '../../types/competition'

const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 disabled:opacity-50 [color-scheme:dark]'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'
const GHOST_BUTTON = 'rounded-lg px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 disabled:opacity-50'

function errorMessage(error: unknown, fallback: string): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para gerenciar locais.'
    const match = text.match(/"message":"([^"]+)"/)
    if (!match) return fallback
    if (match[1].includes('already exists')) return 'Já existe um local com esse nome dentro do mesmo local.'
    if (match[1].includes('under itself')) return 'Um local não pode ficar dentro de si mesmo ou de um de seus sub-locais.'
    return match[1]
}

interface VenueNode extends Venue {
    children: VenueNode[]
}

/** Flat list → tree, children ordered by name. */
function buildTree(venues: Venue[]): VenueNode[] {
    const nodes = new Map<number, VenueNode>(venues.map((v) => [v.id, { ...v, children: [] }]))
    const roots: VenueNode[] = []
    for (const node of nodes.values()) {
        const parent = node.parent_id === null ? undefined : nodes.get(node.parent_id)
        if (parent) parent.children.push(node)
        else roots.push(node)
    }
    const byName = (a: VenueNode, b: VenueNode) => a.name.localeCompare(b.name)
    for (const node of nodes.values()) node.children.sort(byName)
    return roots.sort(byName)
}

/** Ids of a node and everything nested under it. */
function subtreeIds(node: VenueNode): number[] {
    return [node.id, ...node.children.flatMap(subtreeIds)]
}

function ParentSelect({ value, venues, exclude, onChange, disabled }: { value: string; venues: Venue[]; exclude?: Set<number>; onChange: (value: string) => void; disabled?: boolean }) {
    return (
        <select className={INPUT_CLASS} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
            <option value="root">Raiz (sem local acima)</option>
            {venues
                .filter((v) => !exclude?.has(v.id))
                .map((v) => (
                    <option key={v.id} value={String(v.id)}>
                        {v.path}
                    </option>
                ))}
        </select>
    )
}

interface RowProps {
    node: VenueNode
    depth: number
    venues: Venue[]
    matchCount: (ids: number[]) => number
    busyId: number | null
    onAddChild: (parent: VenueNode) => void
    onSave: (node: VenueNode, name: string, parentId: number | null) => Promise<boolean>
    onRemove: (node: VenueNode) => void
}

function VenueRow({ node, depth, venues, matchCount, busyId, onAddChild, onSave, onRemove }: RowProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [name, setName] = useState(node.name)
    const [parent, setParent] = useState(node.parent_id === null ? 'root' : String(node.parent_id))
    const isBusy = busyId === node.id
    const nested = node.children.length
    const matches = matchCount(subtreeIds(node))

    function startEditing() {
        setName(node.name)
        setParent(node.parent_id === null ? 'root' : String(node.parent_id))
        setIsEditing(true)
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const ok = await onSave(node, name.trim(), parent === 'root' ? null : Number(parent))
        if (ok) setIsEditing(false)
    }

    return (
        <>
            <li className={`flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-white/5 ${isBusy ? 'opacity-60' : ''}`} style={{ marginLeft: `${depth * 1.5}rem` }}>
                {isEditing ? (
                    <form className="flex flex-wrap items-center gap-2" onSubmit={save}>
                        <input className={`${INPUT_CLASS} w-44`} value={name} required autoFocus disabled={isBusy} aria-label="Nome do local" onChange={(e) => setName(e.target.value)} />
                        <ParentSelect value={parent} venues={venues} exclude={new Set(subtreeIds(node))} disabled={isBusy} onChange={setParent} />
                        <button type="submit" className={PRIMARY_BUTTON} disabled={isBusy || !name.trim()}>
                            {isBusy ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button type="button" className={GHOST_BUTTON} disabled={isBusy} onClick={() => setIsEditing(false)}>
                            Cancelar
                        </button>
                    </form>
                ) : (
                    <>
                        <span className={`text-zinc-600 ${depth === 0 ? 'hidden' : ''}`} aria-hidden="true">└</span>
                        <span className={`${depth === 0 ? 'font-semibold text-zinc-50' : 'text-zinc-200'}`}>{node.name}</span>
                        <span className="text-xs text-zinc-600">
                            {[nested > 0 ? `${nested} ${nested === 1 ? 'sub-local' : 'sub-locais'}` : null, matches > 0 ? `${matches} ${matches === 1 ? 'jogo' : 'jogos'}` : null].filter(Boolean).join(' · ')}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                            <button type="button" className={GHOST_BUTTON} disabled={isBusy} onClick={() => onAddChild(node)} title={`Adicionar um local dentro de ${node.name}`}>
                                + sub-local
                            </button>
                            <button type="button" className={GHOST_BUTTON} disabled={isBusy} onClick={startEditing}>
                                Editar
                            </button>
                            <button type="button" className={`${GHOST_BUTTON} hover:bg-red-950/60 hover:text-red-200`} disabled={isBusy} onClick={() => onRemove(node)}>
                                Remover
                            </button>
                        </span>
                    </>
                )}
            </li>
            {node.children.map((child) => (
                <VenueRow key={child.id} node={child} depth={depth + 1} venues={venues} matchCount={matchCount} busyId={busyId} onAddChild={onAddChild} onSave={onSave} onRemove={onRemove} />
            ))}
        </>
    )
}

export default function VenuesSection() {
    const [venues, setVenues] = useState<Venue[] | null>(null)
    const [matches, setMatches] = useState<ScheduledMatch[]>([])
    const [error, setError] = useState<string | null>(null)
    const [newName, setNewName] = useState('')
    const [newParent, setNewParent] = useState('root')
    const [isSaving, setIsSaving] = useState(false)
    const [busyId, setBusyId] = useState<number | null>(null)
    const nameInput = useRef<HTMLInputElement>(null)

    useEffect(() => {
        Promise.all([getVenues(), getMatches()])
            .then(([allVenues, allMatches]) => {
                setVenues(allVenues)
                setMatches(allMatches)
            })
            .catch(() => setError('Não foi possível carregar os locais.'))
    }, [])

    const tree = useMemo(() => buildTree(venues ?? []), [venues])

    /** Matches scheduled at any of the given venues. */
    function matchCount(ids: number[]): number {
        const set = new Set(ids)
        return matches.filter((m) => m.venue_id !== null && set.has(m.venue_id)).length
    }

    // Paths change on rename or move, so the whole list is reloaded after each change.
    async function reload() {
        setVenues(await getVenues())
    }

    async function add(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const name = newName.trim()
        if (!name) return
        setError(null)
        setIsSaving(true)
        try {
            await createVenue(name, newParent === 'root' ? null : Number(newParent))
            await reload()
            setNewName('') // keep the parent, so several venues can be added under it in a row
            nameInput.current?.focus()
        } catch (submitError) {
            setError(errorMessage(submitError, 'Não foi possível adicionar o local.'))
        } finally {
            setIsSaving(false)
        }
    }

    function addChild(parent: VenueNode) {
        setNewParent(String(parent.id))
        nameInput.current?.focus()
    }

    async function save(node: VenueNode, name: string, parentId: number | null): Promise<boolean> {
        if (name === node.name && parentId === node.parent_id) return true
        setError(null)
        setBusyId(node.id)
        try {
            await updateVenue(node.id, { name, parentId })
            await reload()
            return true
        } catch (submitError) {
            setError(errorMessage(submitError, 'Não foi possível alterar o local.'))
            return false
        } finally {
            setBusyId(null)
        }
    }

    async function remove(node: VenueNode) {
        const ids = subtreeIds(node)
        const nested = ids.length - 1
        const affected = matchCount(ids)
        const warnings = [
            nested > 0 ? `Os ${nested} ${nested === 1 ? 'sub-local será removido' : 'sub-locais serão removidos'} junto.` : null,
            affected > 0 ? `${affected} ${affected === 1 ? 'jogo marcado aqui ficará' : 'jogos marcados aqui ficarão'} sem local.` : null,
        ].filter(Boolean)
        if (!window.confirm([`Remover "${node.path}"?`, ...warnings].join('\n'))) return

        setError(null)
        setBusyId(node.id)
        try {
            await deleteVenue(node.id)
            await reload()
            setMatches((current) => current.map((m) => (m.venue_id !== null && ids.includes(m.venue_id) ? { ...m, venue_id: null, venue_name: null } : m)))
            if (ids.includes(Number(newParent))) setNewParent('root')
        } catch (submitError) {
            setError(errorMessage(submitError, 'Não foi possível remover o local.'))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Locais</h2>
                <p className="text-sm text-zinc-400">
                    Onde os jogos acontecem. Um local pode ficar dentro de outro, por exemplo "FEF" › "Vôlei" › "Q1"; os jogos são marcados no local mais específico.
                </p>
            </div>

            <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Nome
                    <input ref={nameInput} className={`${INPUT_CLASS} w-44`} value={newName} required placeholder="Ex.: Q1" onChange={(e) => setNewName(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Dentro de
                    <ParentSelect value={newParent} venues={venues ?? []} onChange={setNewParent} />
                </label>
                <button type="submit" className={PRIMARY_BUTTON} disabled={isSaving || !newName.trim()}>
                    {isSaving ? 'Adicionando...' : 'Adicionar'}
                </button>
            </form>

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <div className="mt-6">
                {venues === null && !error ? <Loading /> : null}
                {venues?.length === 0 ? <p className="text-sm text-zinc-500">Nenhum local cadastrado.</p> : null}
                {venues && venues.length > 0 ? (
                    <ul className="space-y-0.5 text-sm">
                        {tree.map((node) => (
                            <VenueRow key={node.id} node={node} depth={0} venues={venues} matchCount={matchCount} busyId={busyId} onAddChild={addChild} onSave={save} onRemove={remove} />
                        ))}
                    </ul>
                ) : null}
            </div>
        </section>
    )
}
