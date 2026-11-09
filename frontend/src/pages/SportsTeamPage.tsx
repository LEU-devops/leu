import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading from '../components/Loading'
import OrganizationLogo from '../components/OrganizationLogo'
import { UserAvatar, UserSearch } from '../components/UserSearch'
import AwardRow from '../components/AwardRow'
import { getLoggedUser } from '../services/auth'
import { deleteSportsTeam, getSportsTeam, getSportsTeamPermissions, renameSportsTeam, setSportsTeamRoster, sportsErrorMessage } from '../services/sports'
import type { SportsTeamDetail, SportsTeamMember, SportsTeamPermissions } from '../types/sports'
import { organizationBackground } from '../utils/gradient'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'
const SECONDARY_BUTTON = 'rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-40'

function SectionHeading({ title, count, accent }: { title: string, count?: number, accent?: string | null }) {
    return (
        <div className="flex items-center gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300" style={{ color: accent ?? undefined }}>{title}</h2>
            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
            {count !== undefined ? <span className="text-xs tabular-nums text-zinc-500">{count}</span> : null}
        </div>
    )
}

function MemberTile({ member }: { member: Pick<SportsTeamMember, 'email' | 'name' | 'profile_photo_url'> }) {
    return (
        <li>
            <Link to={`/pessoas/${encodeURIComponent(member.email)}`} className="group flex w-24 flex-col items-center gap-2">
                <span className="transition group-hover:-translate-y-0.5 [&>*]:h-16 [&>*]:w-16">
                    <UserAvatar name={member.name} photo={member.profile_photo_url} />
                </span>
                <span className="w-full truncate text-center text-xs text-zinc-200">{member.name}</span>
            </Link>
        </li>
    )
}

type DraftMember = SportsTeamMember

interface RosterChanges {
    added: DraftMember[]
    removed: DraftMember[]
    madeDm: DraftMember[]
    unmadeDm: DraftMember[]
}

function rosterChanges(original: SportsTeamMember[], draft: DraftMember[]): RosterChanges {
    const before = new Map(original.map((member) => [member.email, member]))
    const after = new Map(draft.map((member) => [member.email, member]))
    return {
        added: draft.filter((member) => !before.has(member.email)),
        removed: original.filter((member) => !after.has(member.email)),
        madeDm: draft.filter((member) => before.has(member.email) && member.is_dm && !before.get(member.email)!.is_dm),
        unmadeDm: draft.filter((member) => before.has(member.email) && !member.is_dm && before.get(member.email)!.is_dm),
    }
}

function ChangeList({ title, color, items }: { title: string, color: string, items: string[] }) {
    if (items.length === 0)
        return null
    return (
        <div>
            <h3 className={`mb-2 text-xs font-semibold uppercase tracking-[0.2em] ${color}`}>{title} ({items.length})</h3>
            <ul className="space-y-1">{items.map((item) => <li key={item} className="text-zinc-200">{item}</li>)}</ul>
        </div>
    )
}

export default function SportsTeamPage() {
    const params = useParams()
    const id = Number(params.id)
    const invalidId = !Number.isInteger(id) || id <= 0
    const navigate = useNavigate()
    const myEmail = getLoggedUser()?.email ?? null

    const [team, setTeam] = useState<SportsTeamDetail | null>(null)
    const [permissions, setPermissions] = useState<SportsTeamPermissions>({ canManageTeam: false, canManageRoster: false })
    const [loading, setLoading] = useState(!invalidId)
    const [loadError, setLoadError] = useState<string | null>(null)
    const error = invalidId ? 'Time inválido.' : loadError

    const [draft, setDraft] = useState<DraftMember[] | null>(null)
    const [step, setStep] = useState<'idle' | 'review' | 'self' | 'delete'>('idle')
    const [saving, setSaving] = useState(false)
    const [status, setStatus] = useState<{ kind: 'error' | 'success', text: string } | null>(null)
    const [renaming, setRenaming] = useState<string | null>(null)

    useEffect(() => {
        if (invalidId)
            return
        let cancelled = false
        Promise.all([getSportsTeam(id), getSportsTeamPermissions(id)])
            .then(([data, allowed]) => {
                if (cancelled)
                    return
                setTeam(data)
                setPermissions(allowed)
            })
            .catch(() => !cancelled && setLoadError('Não foi possível carregar o time.'))
            .finally(() => !cancelled && setLoading(false))
        return () => {
            cancelled = true
        }
    }, [id, invalidId])

    const changes = useMemo(() => (team && draft ? rosterChanges(team.members, draft) : null), [team, draft])
    const changeCount = changes ? changes.added.length + changes.removed.length + changes.madeDm.length + changes.unmadeDm.length : 0

    /** A DM (who is not an organization manager) removing their own DM role loses access to this editor. */
    const selfLosesAccess = Boolean(
        changes && myEmail && !permissions.canManageTeam
        && [...changes.removed, ...changes.unmadeDm].some((member) => member.email === myEmail && team?.members.find((m) => m.email === myEmail)?.is_dm),
    )

    const closeDialog = useCallback(() => {
        if (!saving)
            setStep('idle')
    }, [saving])

    async function saveRoster() {
        if (!team || !draft)
            return
        setSaving(true)
        setStatus(null)
        try {
            const updated = await setSportsTeamRoster(team.id, draft.map(({ email, is_dm }) => ({ email, is_dm })))
            setTeam(updated)
            setDraft(null)
            setStep('idle')
            if (selfLosesAccess)
                setPermissions({ canManageTeam: false, canManageRoster: false })
            setStatus({ kind: 'success', text: 'Elenco salvo.' })
        } catch (err) {
            setStep('idle')
            setStatus({ kind: 'error', text: sportsErrorMessage(err) })
        } finally {
            setSaving(false)
        }
    }

    async function saveName() {
        if (!team || renaming === null)
            return
        setSaving(true)
        setStatus(null)
        try {
            const updated = await renameSportsTeam(team.id, renaming)
            setTeam(updated)
            setRenaming(null)
        } catch (err) {
            setStatus({ kind: 'error', text: sportsErrorMessage(err) })
        } finally {
            setSaving(false)
        }
    }

    async function removeTeam() {
        if (!team)
            return
        setSaving(true)
        try {
            await deleteSportsTeam(team.id)
            navigate(`/entidades/${team.organization.id}`)
        } catch (err) {
            setStep('idle')
            setStatus({ kind: 'error', text: sportsErrorMessage(err, 'Não foi possível excluir o time.') })
            setSaving(false)
        }
    }

    const accent = team?.organization.accent_color ?? null
    const dms = team?.members.filter((member) => member.is_dm) ?? []
    const athletes = team?.members.filter((member) => !member.is_dm) ?? []

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            {team ? (
                <Link to={`/entidades/${team.organization.id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                    <span aria-hidden>←</span>
                    Voltar para {team.organization.name}
                </Link>
            ) : null}

            {loading ? <Loading /> : null}
            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {!loading && team ? (
                <div className={`mx-auto max-w-5xl space-y-10 ${draft ? 'pb-28' : ''}`}>
                    <header
                        className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-4"
                        style={{ backgroundImage: organizationBackground(team.organization.gradient), borderColor: accent ? `${accent}66` : undefined }}
                    >
                        <OrganizationLogo organization={team.organization} />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500" style={{ color: accent ?? undefined }}>
                                Time · {team.organization.name}
                            </p>
                            {renaming !== null ? (
                                <form className="mt-1 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void saveName() }}>
                                    <input value={renaming} onChange={(event) => setRenaming(event.target.value)} maxLength={60} autoFocus className={`${INPUT_CLASS} max-w-xs`} />
                                    <button type="submit" disabled={saving || renaming.trim().length === 0} className={SECONDARY_BUTTON}>Salvar</button>
                                    <button type="button" onClick={() => setRenaming(null)} className={SECONDARY_BUTTON}>Cancelar</button>
                                </form>
                            ) : (
                                <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">{team.name}</h1>
                            )}
                            <p className="text-sm text-zinc-400">{team.members.length} {team.members.length === 1 ? 'integrante' : 'integrantes'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {permissions.canManageRoster && !draft ? (
                                <button type="button" onClick={() => { setStatus(null); setDraft(team.members) }} className={SECONDARY_BUTTON}>Editar elenco</button>
                            ) : null}
                            {permissions.canManageTeam && renaming === null && !draft ? (
                                <>
                                    <button type="button" onClick={() => setRenaming(team.name)} className={SECONDARY_BUTTON}>Renomear</button>
                                    <button type="button" onClick={() => setStep('delete')} className={`${SECONDARY_BUTTON} text-red-300`}>Excluir</button>
                                </>
                            ) : null}
                        </div>
                    </header>

                    {status && !draft ? (
                        <p className={`rounded-2xl border px-4 py-3 text-sm ${status.kind === 'error' ? 'border-red-900/60 bg-red-950/40 text-red-200' : 'border-emerald-900/60 bg-emerald-950/40 text-emerald-200'}`}>
                            {status.text}
                        </p>
                    ) : null}

                    {draft ? (
                        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                            <SectionHeading title="Editar elenco" count={draft.length} accent={accent} />
                            <UserSearch
                                isTaken={(email) => draft.some((member) => member.email === email)}
                                takenLabel="Já está no time"
                                placeholder="Adicionar atleta: buscar por nome, apelido ou e-mail"
                                onPick={(user) => setDraft([...draft, { email: user.email, name: user.full_name || user.name, profile_photo_url: user.profile_photo_url, is_dm: false }])}
                            />
                            <ul className="space-y-2">
                                {draft.map((member) => {
                                    const isNew = !team.members.some((original) => original.email === member.email)
                                    return (
                                        <li key={member.email} className={`flex items-center gap-3 rounded-2xl border px-4 py-2 ${isNew ? 'border-emerald-800/50 bg-emerald-950/20' : 'border-white/10 bg-black/20'}`}>
                                            <UserAvatar name={member.name} photo={member.profile_photo_url} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm text-zinc-100">
                                                    {member.name}
                                                    {member.email === myEmail ? <span className="ml-2 text-xs text-zinc-500">(você)</span> : null}
                                                </span>
                                                <span className="block truncate text-xs text-zinc-500">{member.email}</span>
                                            </span>
                                            <label className="flex items-center gap-2 text-xs text-zinc-300">
                                                <input
                                                    type="checkbox"
                                                    checked={member.is_dm}
                                                    onChange={(event) => setDraft(draft.map((item) => (item.email === member.email ? { ...item, is_dm: event.target.checked } : item)))}
                                                    className="accent-red-600"
                                                />
                                                DM
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setDraft(draft.filter((item) => item.email !== member.email))}
                                                className="rounded-lg px-3 py-1 text-xs font-medium text-red-300 transition hover:bg-red-950/50"
                                            >
                                                Remover
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ) : (
                        <>
                            <section className="space-y-6">
                                <SectionHeading title="DMs" count={dms.length} accent={accent} />
                                {dms.length > 0
                                    ? <ul className="flex flex-wrap justify-center gap-6">{dms.map((member) => <MemberTile key={member.email} member={member} />)}</ul>
                                    : <p className="text-center text-sm text-zinc-500">Nenhum DM cadastrado.</p>}
                            </section>
                            <section className="space-y-6">
                                <SectionHeading title="Atletas" count={athletes.length} accent={accent} />
                                {athletes.length > 0
                                    ? <ul className="flex flex-wrap justify-center gap-6">{athletes.map((member) => <MemberTile key={member.email} member={member} />)}</ul>
                                    : <p className="text-center text-sm text-zinc-500">Nenhum atleta cadastrado.</p>}
                            </section>
                        </>
                    )}

                    <section className="space-y-4">
                        <SectionHeading title="Premiações" count={team.awards.length} accent={accent} />
                        {team.awards.length > 0
                            ? <ul className="space-y-2">{team.awards.map((award) => <AwardRow key={award.id} award={award} />)}</ul>
                            : <p className="text-center text-sm text-zinc-500">Nenhuma premiação ainda.</p>}
                        {permissions.canManageTeam ? (
                            <p className="text-center text-xs text-zinc-500">
                                Para premiar, use <Link to={`/entidades/${team.organization.id}/esportes`} className="underline hover:text-zinc-300">Gerenciar Esportes da {team.organization.name}</Link>.
                            </p>
                        ) : null}
                    </section>
                </div>
            ) : null}

            {draft && team ? (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm text-zinc-400">
                            {status?.kind === 'error' ? <span className="text-red-300">{status.text}</span>
                                : changeCount > 0 ? `${changeCount} ${changeCount === 1 ? 'alteração pendente' : 'alterações pendentes'}` : 'Nenhuma alteração pendente'}
                        </span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setDraft(null); setStatus(null) }} className={SECONDARY_BUTTON}>Cancelar</button>
                            <button
                                type="button"
                                disabled={changeCount === 0}
                                onClick={() => setStep('review')}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Salvar elenco
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {step === 'review' && changes && team ? (
                <ConfirmDialog
                    title="Confirmar alterações no elenco"
                    confirmLabel={selfLosesAccess ? 'Continuar' : 'Confirmar e salvar'}
                    busy={saving}
                    onCancel={closeDialog}
                    onConfirm={() => (selfLosesAccess ? setStep('self') : void saveRoster())}
                >
                    <p className="mb-4">As seguintes alterações serão aplicadas ao {team.name}:</p>
                    <div className="space-y-4">
                        <ChangeList title="Adicionar" color="text-emerald-400" items={changes.added.map((member) => `+ ${member.name}${member.is_dm ? ' (DM)' : ''}`)} />
                        <ChangeList title="Tornar DM" color="text-amber-400" items={changes.madeDm.map((member) => `~ ${member.name}`)} />
                        <ChangeList title="Deixar de ser DM" color="text-amber-400" items={changes.unmadeDm.map((member) => `~ ${member.name}`)} />
                        <ChangeList title="Remover" color="text-red-400" items={changes.removed.map((member) => `− ${member.name}${member.is_dm ? ' (DM)' : ''}`)} />
                    </div>
                </ConfirmDialog>
            ) : null}

            {step === 'self' && team ? (
                <ConfirmDialog title="Você está deixando de ser DM" confirmLabel="Sim, continuar" danger busy={saving} onCancel={closeDialog} onConfirm={() => void saveRoster()}>
                    <p>Você está deixando de ser DM do <strong className="text-zinc-100">{team.name}</strong>.</p>
                    <p className="mt-3 rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-red-200">Depois de salvar, você não poderá mais editar o elenco deste time.</p>
                    <p className="mt-3">Tem certeza de que deseja continuar?</p>
                </ConfirmDialog>
            ) : null}

            {step === 'delete' && team ? (
                <ConfirmDialog title="Excluir time" confirmLabel="Excluir time" danger busy={saving} onCancel={closeDialog} onConfirm={() => void removeTeam()}>
                    <p>O time <strong className="text-zinc-100">{team.name}</strong> e o seu elenco serão excluídos.</p>
                    <p className="mt-3">As premiações já dadas continuam no perfil dos atletas, mas sem o vínculo com o time.</p>
                </ConfirmDialog>
            ) : null}
        </main>
    )
}
