import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading from '../components/Loading'
import Select from '../components/Select'
import { getLoggedUser } from '../services/auth'
import { getOrganizations } from '../services/competition'
import { createOrganizationPosition, deleteOrganizationPosition, getOrganizationPermissions, getOrganizationPositions, updateOrganizationMembers, updateOrganizationPosition } from '../services/organizations'
import { getOrganization } from '../services/competition'
import { sportsErrorMessage } from '../services/sports'
import PeriodHistory from '../components/PeriodHistory'
import type { PositionPeriod } from '../types/sports'
import { UserAvatar, UserSearch } from '../components/UserSearch'
import { ROLE_OPTIONS, roleLabel } from '../utils/roles'
import type { MemberAddition, OrganizationHierarchy, OrganizationMember, OrganizationRole, UserSearchResult } from '../types/organizations'


const ROLE_ORDER: Record<OrganizationRole, number> = { presidente: 0, vice: 1, diretor: 2, conselheiro: 3, membro: 4, aluno: 5 }

const LEU_AREAS = ['Administrativo-Financeiro', 'Marketing', 'Produtos', 'Eventos', 'Parcerias', 'Patrimônios', 'Esportes', 'Secretaria', 'Social']

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'

type Position = Pick<OrganizationMember, 'role' | 'director_area'>

/** A pending addition, with the user data needed to display it. */
type PendingAddition = MemberAddition & Pick<UserSearchResult, 'name' | 'profile_photo_url'>

function samePosition(a: Position, b: Position): boolean {
    return a.role === b.role && (a.director_area ?? '').trim().toLowerCase() === (b.director_area ?? '').trim().toLowerCase()
}

function isManagerPosition({ role, director_area }: Position): boolean {
    return role === 'presidente' || (role === 'diretor' && (director_area ?? '').trim().toLowerCase() === 'secretaria')
}

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403'))
        return 'Você não tem permissão para gerenciar os membros desta entidade.'
    const match = text.match(/"message":"([^"]+)"/)
    return match ? match[1] : 'Não foi possível salvar. Tente novamente.'
}

function AddMemberForm({ areaSuggestions, isTaken, onAdd }: {
    areaSuggestions: string[]
    isTaken: (email: string) => boolean
    onAdd: (addition: PendingAddition) => void
}) {
    const [user, setUser] = useState<UserSearchResult | null>(null)
    const [role, setRole] = useState<OrganizationRole>('membro')
    const [area, setArea] = useState('')

    const needsArea = role === 'diretor'
    const canAdd = user !== null && (!needsArea || area.trim().length > 0)

    function submit() {
        if (!user || !canAdd)
            return
        onAdd({
            email: user.email,
            name: user.full_name || user.name,
            profile_photo_url: user.profile_photo_url,
            role,
            director_area: needsArea ? area.trim() : null,
        })
        setUser(null)
        setArea('')
    }

    return (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">Adicionar membro</h2>

            {user ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <UserAvatar name={user.name} photo={user.profile_photo_url} />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-100">{user.full_name || user.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{user.email}</span>
                    </span>
                    <button type="button" onClick={() => setUser(null)} className="text-xs text-zinc-400 transition hover:text-zinc-200">
                        Trocar
                    </button>
                </div>
            ) : (
                <UserSearch isTaken={isTaken} onPick={setUser} />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                    <span className="text-xs text-zinc-400">Cargo</span>
                    <Select value={role} options={ROLE_OPTIONS} onChange={setRole} />
                </label>
                {needsArea ? (
                    <label className="space-y-1">
                        <span className="text-xs text-zinc-400">Diretoria</span>
                        <input
                            list="director-areas"
                            value={area}
                            onChange={(event) => setArea(event.target.value)}
                            placeholder="Ex.: Secretaria"
                            className={INPUT_CLASS}
                        />
                        <datalist id="director-areas">
                            {areaSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
                        </datalist>
                    </label>
                ) : null}
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canAdd}
                    className="rounded-xl border border-red-600/60 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Adicionar à lista
                </button>
            </div>
        </section>
    )
}

interface Changes {
    additions: PendingAddition[]
    removals: OrganizationMember[]
    /** Members removed and re-added with another position. */
    roleChanges: { before: OrganizationMember, after: PendingAddition }[]
}

function ChangeSummary({ changes }: { changes: Changes }) {
    return (
        <div className="space-y-4">
            {changes.additions.length > 0 ? (
                <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Adicionar ({changes.additions.length})</h3>
                    <ul className="space-y-1">
                        {changes.additions.map((addition) => (
                            <li key={addition.email}>
                                <span className="text-emerald-400">+</span> <strong className="text-zinc-100">{addition.name}</strong> como {roleLabel(addition)}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {changes.roleChanges.length > 0 ? (
                <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Alterar cargo ({changes.roleChanges.length})</h3>
                    <ul className="space-y-1">
                        {changes.roleChanges.map(({ before, after }) => (
                            <li key={before.email}>
                                <span className="text-amber-400">~</span> <strong className="text-zinc-100">{before.name}</strong>: {roleLabel(before)} → {roleLabel(after)}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {changes.removals.length > 0 ? (
                <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Remover ({changes.removals.length})</h3>
                    <ul className="space-y-1">
                        {changes.removals.map((member) => (
                            <li key={member.email}>
                                <span className="text-red-400">−</span> <strong className="text-zinc-100">{member.name}</strong> ({roleLabel(member)})
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    )
}

export default function OrganizationMembersPage() {
    const params = useParams()
    const id = Number(params.id)
    const navigate = useNavigate()
    const myEmail = getLoggedUser()?.email ?? null

    const [organization, setOrganization] = useState<OrganizationHierarchy | null>(null)
    const [isLeuManager, setIsLeuManager] = useState(false)
    const [canManage, setCanManage] = useState(false)
    const invalidId = !Number.isInteger(id) || id <= 0
    const [loading, setLoading] = useState(!invalidId)
    const [loadError, setLoadError] = useState<string | null>(null)
    const error = invalidId ? 'Entidade inválida.' : loadError

    const [positions, setPositions] = useState<PositionPeriod[]>([])
    const [removed, setRemoved] = useState<Set<string>>(new Set())
    const [added, setAdded] = useState<PendingAddition[]>([])

    const [step, setStep] = useState<'idle' | 'review' | 'self'>('idle')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [savedMessage, setSavedMessage] = useState<string | null>(null)

    useEffect(() => {
        if (invalidId)
            return

        let cancelled = false
        Promise.all([getOrganizations(), getOrganizationPermissions(id).then((result) => result.canManageMembers), getOrganizationPositions(id)])
            .then(([all, allowed, history]) => {
                if (cancelled)
                    return
                const current = all.find((row) => row.id === id)
                if (!current) {
                    setLoadError('Entidade não encontrada.')
                    return
                }
                const leu = all.find((row) => row.name === 'LEU')
                setOrganization(current)
                setPositions(history)
                setCanManage(allowed)
                setIsLeuManager(Boolean(myEmail && leu?.members.some((member) => member.email === myEmail && isManagerPosition(member))))
            })
            .catch(() => {
                if (!cancelled)
                    setLoadError('Não foi possível carregar a entidade.')
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [id, invalidId, myEmail])

    const members = useMemo(
        () => [...(organization?.members ?? [])].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, 'pt-BR')),
        [organization],
    )

    const changes = useMemo<Changes>(() => {
        const byEmail = new Map(members.map((member) => [member.email, member]))
        const addedByEmail = new Map(added.map((addition) => [addition.email, addition]))
        const result: Changes = { additions: [], removals: [], roleChanges: [] }

        for (const addition of added) {
            const before = removed.has(addition.email) ? byEmail.get(addition.email) : undefined
            if (!before)
                result.additions.push(addition)
            else if (!samePosition(before, addition))
                result.roleChanges.push({ before, after: addition })
        }
        for (const email of removed) {
            const member = byEmail.get(email)
            if (member && !addedByEmail.has(email))
                result.removals.push(member)
        }
        return result
    }, [members, added, removed])

    const changeCount = changes.additions.length + changes.removals.length + changes.roleChanges.length
    const hasChanges = changeCount > 0

    /** The logged-in user's own position change, if any. */
    const selfChange = useMemo(() => {
        if (!myEmail)
            return null
        const removal = changes.removals.find((member) => member.email === myEmail)
        if (removal)
            return { before: removal as Position, after: null as Position | null }
        const roleChange = changes.roleChanges.find(({ before }) => before.email === myEmail)
        if (roleChange)
            return { before: roleChange.before as Position, after: roleChange.after as Position }
        return null
    }, [changes, myEmail])

    const losesAccess = selfChange !== null && !isLeuManager && !(selfChange.after && isManagerPosition(selfChange.after))

    useEffect(() => {
        if (!hasChanges)
            return
        function onBeforeUnload(event: BeforeUnloadEvent) {
            event.preventDefault()
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [hasChanges])

    const isTaken = useCallback(
        (email: string) => added.some((addition) => addition.email === email)
            || (members.some((member) => member.email === email) && !removed.has(email)),
        [added, members, removed],
    )

    const areaSuggestions = useMemo(() => {
        const areas = new Set<string>(['Secretaria'])
        if (organization?.name === 'LEU')
            LEU_AREAS.forEach((area) => areas.add(area))
        members.forEach((member) => member.director_area && areas.add(member.director_area))
        return [...areas].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [organization, members])

    function toggleRemoved(email: string) {
        setSavedMessage(null)
        const next = new Set(removed)
        if (next.has(email)) {
            next.delete(email)
            // Un-removing a member drops a pending re-add of the same person.
            setAdded((list) => list.filter((addition) => addition.email !== email))
        } else {
            next.add(email)
        }
        setRemoved(next)
    }

    function discard() {
        setRemoved(new Set())
        setAdded([])
        setSaveError(null)
    }

    const closeDialog = useCallback(() => {
        if (!saving)
            setStep('idle')
    }, [saving])

    async function save() {
        if (!organization)
            return
        setSaving(true)
        setSaveError(null)
        try {
            const updated = await updateOrganizationMembers(organization.id, {
                add: [...changes.additions, ...changes.roleChanges.map(({ after }) => after)].map(({ email, role, director_area }) => ({ email, role, director_area })),
                remove: [...changes.removals.map((member) => member.email), ...changes.roleChanges.map(({ before }) => before.email)],
            })
            if (losesAccess) {
                navigate(`/entidades/${organization.id}`)
                return
            }
            setOrganization(updated)
            setPositions(await getOrganizationPositions(organization.id))
            setRemoved(new Set())
            setAdded([])
            setSavedMessage(`${changeCount} ${changeCount === 1 ? 'alteração salva' : 'alterações salvas'}.`)
            setStep('idle')
        } catch (err) {
            setSaveError(errorMessage(err))
            setStep('idle')
        } finally {
            setSaving(false)
        }
    }

    /** History edits can change who is current, so the members list is reloaded too. */
    async function afterHistoryChange(history: PositionPeriod[]) {
        setPositions(history)
        if (organization)
            setOrganization(await getOrganization(organization.id))
    }

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <Link to={`/entidades/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                <span aria-hidden>←</span>
                Voltar para a entidade
            </Link>

            {loading ? <Loading /> : null}
            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {!loading && !error && organization && !canManage ? (
                <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                    Apenas presidentes e secretários da {organization.name} (ou da LEU) podem gerenciar os membros.
                </p>
            ) : null}

            {!loading && !error && organization && canManage ? (
                <div className="mx-auto max-w-3xl space-y-6 pb-28">
                    <header>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{organization.name}</p>
                        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Gerenciar membros</h1>
                        <p className="text-sm text-zinc-400">
                            Adicione e remova membros à vontade; nada é salvo até você clicar em “Salvar alterações”. Para trocar o cargo de alguém, remova e adicione de novo com o novo cargo.
                        </p>
                    </header>

                    <AddMemberForm areaSuggestions={areaSuggestions} isTaken={isTaken} onAdd={(addition) => {
                        setSavedMessage(null)
                        setAdded((list) => [...list, addition])
                    }} />

                    {added.length > 0 ? (
                        <section className="space-y-3">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">A adicionar</h2>
                            <ul className="space-y-2">
                                {added.map((addition) => (
                                    <li key={addition.email} className="flex items-center gap-3 rounded-2xl border border-emerald-800/50 bg-emerald-950/20 px-4 py-2">
                                        <UserAvatar name={addition.name} photo={addition.profile_photo_url} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm text-zinc-100">{addition.name}</span>
                                            <span className="block truncate text-xs text-zinc-400">{roleLabel(addition)}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setAdded((list) => list.filter((item) => item.email !== addition.email))}
                                            className="text-xs text-zinc-400 transition hover:text-zinc-200"
                                        >
                                            Desfazer
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : null}

                    <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">Membros atuais ({members.length})</h2>
                        {members.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">Nenhum membro cadastrado.</p>
                        ) : (
                            <ul className="space-y-2">
                                {members.map((member) => {
                                    const isRemoved = removed.has(member.email)
                                    return (
                                        <li
                                            key={member.email}
                                            className={`flex items-center gap-3 rounded-2xl border px-4 py-2 transition ${
                                                isRemoved ? 'border-red-900/60 bg-red-950/20' : 'border-white/10 bg-white/[0.03]'
                                            }`}
                                        >
                                            <UserAvatar name={member.name} photo={member.profile_photo_url} />
                                            <span className={`min-w-0 flex-1 ${isRemoved ? 'opacity-50' : ''}`}>
                                                <span className={`block truncate text-sm text-zinc-100 ${isRemoved ? 'line-through' : ''}`}>
                                                    {member.name}
                                                    {member.email === myEmail ? <span className="ml-2 text-xs text-zinc-500">(você)</span> : null}
                                                </span>
                                                <span className="block truncate text-xs text-zinc-400">{roleLabel(member)}</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggleRemoved(member.email)}
                                                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                                                    isRemoved ? 'text-zinc-300 hover:bg-white/5' : 'text-red-300 hover:bg-red-950/50'
                                                }`}
                                            >
                                                {isRemoved ? 'Desfazer' : 'Remover'}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">Histórico ({positions.length})</h2>
                        <p className="text-sm text-zinc-400">
                            Todos os períodos, atuais e antigos. Adicionar e remover membros acima já abre e encerra os períodos com a data do dia;
                            aqui você corrige datas e registra quem fez parte antes. Estas edições são salvas na hora.
                        </p>
                        {hasChanges ? (
                            <p className="rounded-xl border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                                Salve ou descarte as alterações pendentes antes de editar o histórico.
                            </p>
                        ) : null}
                        <PeriodHistory
                            rows={positions.map((position) => ({ ...position, label: roleLabel(position) }))}
                            canEdit={!hasChanges}
                            roleOptions={ROLE_OPTIONS}
                            needsArea={(role) => role === 'diretor'}
                            areaSuggestions={areaSuggestions}
                            errorMessage={(err) => sportsErrorMessage(err)}
                            onCreate={async (period) => afterHistoryChange(await createOrganizationPosition(organization.id, { ...period, role: period.role as OrganizationRole }))}
                            onUpdate={async (positionId, period) => afterHistoryChange(await updateOrganizationPosition(organization.id, positionId, period))}
                            onDelete={async (positionId) => afterHistoryChange(await deleteOrganizationPosition(organization.id, positionId))}
                        />
                    </section>
                </div>
            ) : null}

            {canManage && organization ? (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur">
                    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm text-zinc-400">
                            {saveError ? <span className="text-red-300">{saveError}</span>
                                : savedMessage && !hasChanges ? <span className="text-emerald-300">{savedMessage}</span>
                                    : hasChanges ? `${changeCount} ${changeCount === 1 ? 'alteração pendente' : 'alterações pendentes'}`
                                        : 'Nenhuma alteração pendente'}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={discard}
                                disabled={!hasChanges}
                                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"
                            >
                                Descartar
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('review')}
                                disabled={!hasChanges}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Salvar alterações
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {step === 'review' && organization ? (
                <ConfirmDialog
                    title="Confirmar alterações"
                    confirmLabel={selfChange ? 'Continuar' : 'Confirmar e salvar'}
                    busy={saving}
                    onCancel={closeDialog}
                    onConfirm={() => (selfChange ? setStep('self') : save())}
                >
                    <p className="mb-4">As seguintes alterações serão aplicadas aos membros da {organization.name}:</p>
                    <ChangeSummary changes={changes} />
                </ConfirmDialog>
            ) : null}

            {step === 'self' && organization && selfChange ? (
                <ConfirmDialog
                    title="Você está saindo do seu cargo"
                    confirmLabel="Sim, sair do cargo"
                    danger
                    busy={saving}
                    onCancel={closeDialog}
                    onConfirm={save}
                >
                    <p>
                        {selfChange.after
                            ? <>Você está trocando o seu próprio cargo de <strong className="text-zinc-100">{roleLabel(selfChange.before)}</strong> para <strong className="text-zinc-100">{roleLabel(selfChange.after)}</strong> na {organization.name}.</>
                            : <>Você está se removendo do cargo de <strong className="text-zinc-100">{roleLabel(selfChange.before)}</strong> da {organization.name}.</>}
                    </p>
                    {losesAccess ? (
                        <p className="mt-3 rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-red-200">
                            Depois de salvar, você não poderá mais gerenciar os membros desta entidade.
                        </p>
                    ) : null}
                    <p className="mt-3">Tem certeza de que deseja continuar?</p>
                </ConfirmDialog>
            ) : null}
        </main>
    )
}
