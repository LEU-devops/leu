import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AwardRow from '../components/AwardRow'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading from '../components/Loading'
import Select from '../components/Select'
import { UserAvatar, UserSearch } from '../components/UserSearch'
import { MedalIcon } from '../components/badges/BadgeIcons'
import { PLACEMENT_COLORS, PLACEMENT_LABELS } from '../utils/awards'
import { getOrganization } from '../services/competition'
import { getOrganizationPermissions } from '../services/organizations'
import { createAward, createSportsTeam, deleteAward, getAwards, getSportsTeams, sportsErrorMessage } from '../services/sports'
import type { OrganizationHierarchy } from '../types/organizations'
import type { Award, AwardPlacement, SportsTeam } from '../types/sports'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'
const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40'

const TITLE_SUGGESTIONS = ['Atleta Destaque', 'Atleta Revelação', 'Artilheiro(a)', 'MVP', 'Melhor Goleiro(a)']
const COMPETITION_SUGGESTIONS = ['Copa Bixo', 'Copa Eng', 'TUSCA', 'InterGestões', 'Melhores do Ano', 'Jubileu']

type PlacementChoice = AwardPlacement | 'nenhuma'
const PLACEMENT_OPTIONS: { value: PlacementChoice, label: string }[] = [
    { value: 'ouro', label: 'Ouro' },
    { value: 'prata', label: 'Prata' },
    { value: 'bronze', label: 'Bronze' },
    { value: 'nenhuma', label: 'Sem colocação (destaque)' },
]

interface Recipient {
    email: string
    name: string
    profile_photo_url: string | null
}

function Card({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">{title}</h2>
            {children}
        </section>
    )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-xs text-zinc-400">{label}</span>
            {children}
        </label>
    )
}

function NewTeamForm({ organizationId, onCreated }: { organizationId: number, onCreated: (team: SportsTeam) => void }) {
    const [name, setName] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setSaving(true)
        setError(null)
        try {
            onCreated(await createSportsTeam(organizationId, name))
            setName('')
        } catch (err) {
            setError(sportsErrorMessage(err))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-2">
            <div className="flex flex-wrap gap-2">
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Ex.: Vôlei Masculino" className={`${INPUT_CLASS} min-w-0 flex-1`} />
                <button type="submit" disabled={saving || name.trim().length === 0} className={PRIMARY_BUTTON}>Criar time</button>
            </div>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <p className="text-[11px] text-zinc-500">Depois de criar, abra o time para montar o elenco e escolher os DMs.</p>
        </form>
    )
}

function NewAwardForm({ organization, teams, onCreated }: { organization: OrganizationHierarchy, teams: SportsTeam[], onCreated: (award: Award) => void }) {
    const [title, setTitle] = useState('')
    const [placement, setPlacement] = useState<PlacementChoice>('nenhuma')
    const [competition, setCompetition] = useState('')
    const [year, setYear] = useState(String(new Date().getFullYear()))
    const [teamId, setTeamId] = useState<number | ''>('')
    const [recipients, setRecipients] = useState<Recipient[]>([])
    const [confirming, setConfirming] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const team = teams.find((row) => row.id === teamId) ?? null

    const yearNumber = Number(year)
    const valid = title.trim().length > 0 && Number.isInteger(yearNumber) && yearNumber >= 1950 && yearNumber <= 2100
        && recipients.length > 0

    async function save() {
        setSaving(true)
        setError(null)
        try {
            const award = await createAward({
                organization_id: organization.id,
                kind: 'individual',
                title: title.trim(),
                placement: placement === 'nenhuma' ? null : placement,
                competition: competition.trim() || null,
                year: yearNumber,
                sports_team_id: team?.id ?? null,
                recipients: recipients.map((recipient) => recipient.email),
            })
            onCreated(award)
            setTitle('')
            setRecipients([])
            setConfirming(false)
        } catch (err) {
            setError(sportsErrorMessage(err))
            setConfirming(false)
        } finally {
            setSaving(false)
        }
    }

    const color = PLACEMENT_COLORS[placement === 'nenhuma' ? 'none' : placement]

    return (
        <div className="space-y-4">
            <p className="text-xs text-zinc-500">
                Medalha para uma ou mais pessoas, fora de um campeonato (ex.: Atleta Revelação nos Melhores do Ano). Resultados de equipe e premiações dentro de um campeonato
                (MVP, destaque) ficam na participação, na página do time{organization.name !== 'LEU' ? ' ou em Copas' : ''}.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Título">
                    <input list="award-titles" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Ex.: Campeão" className={INPUT_CLASS} />
                    <datalist id="award-titles">{TITLE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
                </Field>
                <Field label="Colocação">
                    <Select value={placement} options={PLACEMENT_OPTIONS} onChange={setPlacement} />
                </Field>
                <Field label="Competição / evento">
                    <input list="award-competitions" value={competition} onChange={(event) => setCompetition(event.target.value)} maxLength={80} placeholder="Ex.: TUSCA" className={INPUT_CLASS} />
                    <datalist id="award-competitions">{COMPETITION_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
                </Field>
                <Field label="Ano">
                    <input type="number" min={1950} max={2100} value={year} onChange={(event) => setYear(event.target.value)} className={INPUT_CLASS} />
                </Field>
                <Field label="Time (opcional)">
                    <Select
                        value={teamId}
                        placeholder={teams.length === 0 ? 'Nenhum time cadastrado' : 'Selecione...'}
                        options={[
                            { value: 0, label: 'Nenhum time' },
                            ...teams.map((row) => ({ value: row.id, label: row.name })),
                        ]}
                        onChange={(value) => setTeamId(value === 0 ? '' : value)}
                    />
                </Field>
            </div>

            <div className="space-y-2">
                <span className="text-xs text-zinc-400">Premiados ({recipients.length})</span>
                {recipients.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                        {recipients.map((recipient) => (
                            <li key={recipient.email} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-1 pr-3 text-sm text-zinc-200">
                                <span className="[&>*]:h-6 [&>*]:w-6 [&>*]:text-[9px]"><UserAvatar name={recipient.name} photo={recipient.profile_photo_url} /></span>
                                {recipient.name}
                                <button type="button" onClick={() => setRecipients(recipients.filter((item) => item.email !== recipient.email))} className="text-zinc-500 hover:text-zinc-200" aria-label={`Remover ${recipient.name}`}>×</button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                <UserSearch
                    isTaken={(email) => recipients.some((recipient) => recipient.email === email)}
                    takenLabel="Já incluído"
                    placeholder="Buscar a pessoa premiada"
                    onPick={(user) => setRecipients([...recipients, { email: user.email, name: user.full_name || user.name, profile_photo_url: user.profile_photo_url }])}
                />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <div className="flex justify-end">
                <button type="button" disabled={!valid} onClick={() => setConfirming(true)} className={PRIMARY_BUTTON}>Premiar</button>
            </div>

            {confirming ? (
                <ConfirmDialog title="Confirmar premiação" confirmLabel="Confirmar e premiar" busy={saving} onCancel={() => !saving && setConfirming(false)} onConfirm={() => void save()}>
                    <div className="flex items-center gap-3">
                        <MedalIcon color={color} className="h-10 w-10" />
                        <div>
                            <p className="font-semibold text-zinc-100">{title.trim()}</p>
                            <p className="text-xs text-zinc-400">
                                {[placement === 'nenhuma' ? null : PLACEMENT_LABELS[placement], competition.trim() || null, yearNumber, team?.name, organization.name].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    </div>
                    <p className="mt-4 mb-2">Vai aparecer no perfil de {recipients.length} {recipients.length === 1 ? 'pessoa' : 'pessoas'}:</p>
                    <p className="text-zinc-200">{recipients.map((recipient) => recipient.name).join(', ')}</p>
                </ConfirmDialog>
            ) : null}
        </div>
    )
}

export default function OrganizationSportsPage() {
    const params = useParams()
    const id = Number(params.id)
    const invalidId = !Number.isInteger(id) || id <= 0

    const [organization, setOrganization] = useState<OrganizationHierarchy | null>(null)
    const [teams, setTeams] = useState<SportsTeam[]>([])
    const [awards, setAwards] = useState<Award[]>([])
    const [canManage, setCanManage] = useState(false)
    const [loading, setLoading] = useState(!invalidId)
    const [loadError, setLoadError] = useState<string | null>(null)
    const error = invalidId ? 'Entidade inválida.' : loadError

    const [toDelete, setToDelete] = useState<Award | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    useEffect(() => {
        if (invalidId)
            return
        let cancelled = false
        Promise.all([getOrganization(id), getOrganizationPermissions(id), getSportsTeams(id), getAwards({ organizationId: id })])
            .then(([org, permissions, teamList, awardList]) => {
                if (cancelled)
                    return
                setOrganization(org)
                setCanManage(permissions.canManageSports)
                setTeams(teamList)
                setAwards(awardList)
            })
            .catch(() => !cancelled && setLoadError('Não foi possível carregar a entidade.'))
            .finally(() => !cancelled && setLoading(false))
        return () => {
            cancelled = true
        }
    }, [id, invalidId])

    const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [teams])

    const closeDelete = useCallback(() => {
        if (!deleting)
            setToDelete(null)
    }, [deleting])

    async function confirmDelete() {
        if (!toDelete)
            return
        setDeleting(true)
        setDeleteError(null)
        try {
            await deleteAward(toDelete.id)
            setAwards((list) => list.filter((award) => award.id !== toDelete.id))
            setToDelete(null)
        } catch (err) {
            setDeleteError(sportsErrorMessage(err, 'Não foi possível excluir a premiação.'))
            setToDelete(null)
        } finally {
            setDeleting(false)
        }
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
                    Apenas presidentes e diretores de Esportes da {organization.name} (ou da LEU) podem gerenciar times e premiações.
                </p>
            ) : null}

            {!loading && !error && organization && canManage ? (
                <div className="mx-auto max-w-5xl space-y-6">
                    <header>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{organization.name}</p>
                        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Gerenciar esportes</h1>
                        <p className="text-sm text-zinc-400">
                            Times, DMs e premiações avulsas (ex.: Melhores do Ano). O elenco e os campeonatos de cada time ficam na página do time e podem ser editados também pelos DMs.
                            {organization.name !== 'LEU' ? <> Atletas e premiações nas Copas da LEU ficam em <Link to={`/entidades/${organization.id}/copas`} className="underline hover:text-zinc-200">Copas</Link>.</> : null}
                        </p>
                    </header>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                        <Card title={`Times (${teams.length})`}>
                            <NewTeamForm organizationId={organization.id} onCreated={(team) => setTeams((list) => [...list, team])} />
                            {sortedTeams.length > 0 ? (
                                <ul className="space-y-2">
                                    {sortedTeams.map((team) => {
                                        const dms = team.members.filter((member) => member.is_dm)
                                        return (
                                            <li key={team.id}>
                                                <Link to={`/times/${team.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 transition hover:bg-white/5">
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-semibold text-zinc-100">{team.name}</span>
                                                        <span className="block truncate text-xs text-zinc-500">
                                                            {team.members.length} {team.members.length === 1 ? 'integrante' : 'integrantes'}
                                                            {' · '}
                                                            {dms.length > 0 ? `DM: ${dms.map((member) => member.name).join(', ')}` : 'sem DM'}
                                                        </span>
                                                    </span>
                                                    <span className="text-zinc-500" aria-hidden>→</span>
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : <p className="text-sm text-zinc-500">Nenhum time cadastrado.</p>}
                        </Card>

                        <div className="space-y-6">
                            <Card title="Nova premiação">
                                <NewAwardForm organization={organization} teams={sortedTeams} onCreated={(award) => setAwards((list) => [award, ...list])} />
                            </Card>

                            <Card title={`Premiações dadas (${awards.length})`}>
                                {deleteError ? <p className="text-sm text-red-300">{deleteError}</p> : null}
                                {awards.length > 0 ? (
                                    <ul className="space-y-2">
                                        {awards.map((award) => (
                                            <AwardRow
                                                key={award.id}
                                                award={award}
                                                action={(
                                                    <button type="button" onClick={() => setToDelete(award)} className="rounded-lg px-3 py-1 text-xs font-medium text-red-300 transition hover:bg-red-950/50">
                                                        Excluir
                                                    </button>
                                                )}
                                            />
                                        ))}
                                    </ul>
                                ) : <p className="text-sm text-zinc-500">Nenhuma premiação dada ainda.</p>}
                            </Card>
                        </div>
                    </div>
                </div>
            ) : null}

            {toDelete ? (
                <ConfirmDialog title="Excluir premiação" confirmLabel="Excluir" danger busy={deleting} onCancel={closeDelete} onConfirm={() => void confirmDelete()}>
                    <p>
                        A premiação <strong className="text-zinc-100">{toDelete.title}</strong> ({[toDelete.competition, toDelete.year].filter(Boolean).join(' ')}) será removida do perfil de{' '}
                        {toDelete.recipients.length} {toDelete.recipients.length === 1 ? 'pessoa' : 'pessoas'}.
                    </p>
                </ConfirmDialog>
            ) : null}
        </main>
    )
}
