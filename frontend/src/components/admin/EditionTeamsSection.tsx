import { useEffect, useState } from 'react'
import Loading from '../Loading'
import OrganizationLogo from '../OrganizationLogo'
import Select from '../Select'
import { addTeam, getOrganizations, getTeams, removeTeam, renameTeam } from '../../services/competition'
import type { Team } from '../../types/competition'
import type { OrganizationHierarchy } from '../../types/organizations'

const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'
const SMALL_BUTTON = 'rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-40'

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para gerenciar os times.'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    if (/already called/.test(message)) return 'Outro time já usa esse nome nesta edição.'
    if (/already plays in/.test(message)) return 'Este time já está em chave, inscrição ou prova desta edição e não pode sair dela.'
    if (/participations or results/.test(message)) return 'Este time já tem participações ou resultados nesta edição e não pode sair dela.'
    return 'Não foi possível salvar.'
}

/**
 * The teams of an edition: the entities that play it and the name each one shows there. A new
 * edition starts with the teams of the cup's last edition. Mounted with `key={editionId}`.
 */
export default function EditionTeamsSection({ editionId }: { editionId: number }) {
    const [teams, setTeams] = useState<Team[] | null>(null)
    const [organizations, setOrganizations] = useState<OrganizationHierarchy[]>([])
    const [renaming, setRenaming] = useState<{ id: number, name: string } | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([getTeams(editionId), getOrganizations()])
            .then(([teamList, organizationList]) => {
                setTeams(teamList)
                setOrganizations(organizationList)
            })
            .catch(() => setError('Não foi possível carregar os times.'))
    }, [editionId])

    const organizationOf = new Map(organizations.map((organization) => [organization.id, organization]))
    const available = organizations.filter((organization) => !teams?.some((team) => team.id === organization.id))

    async function run(action: () => Promise<void>) {
        setBusy(true)
        setError(null)
        try {
            await action()
            return true
        } catch (err) {
            setError(errorMessage(err))
            return false
        } finally {
            setBusy(false)
        }
    }

    const sortByName = (list: Team[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Times da edição</h2>
                <p className="text-sm text-zinc-400">
                    Entidades que disputam esta edição e o nome com que aparecem nela (chaveamentos, provas e pontuação). Só sai da edição o time que ainda não jogou nem tem resultado nela.
                </p>
            </div>

            {available.length > 0 ? (
                <div className="w-72">
                    <Select
                        value=""
                        placeholder="Adicionar entidade..."
                        options={available.map((organization) => ({ value: organization.id, label: organization.short_name ? `${organization.short_name} (${organization.name})` : organization.name }))}
                        onChange={(organizationId) => void run(async () => {
                            const team = await addTeam(editionId, organizationId)
                            setTeams((list) => sortByName([...(list ?? []), team]))
                        })}
                    />
                </div>
            ) : null}

            {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <div className="mt-5">
                {teams === null && !error ? <Loading /> : null}
                {teams?.length === 0 ? <p className="text-sm text-zinc-500">Nenhum time nesta edição.</p> : null}
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {teams?.map((team) => {
                        const organization = organizationOf.get(team.id)
                        return (
                            <li key={team.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                {organization ? <OrganizationLogo organization={organization} className="h-9 w-9" /> : null}
                                {renaming?.id === team.id ? (
                                    <form
                                        className="flex min-w-0 flex-1 gap-1"
                                        onSubmit={(event) => {
                                            event.preventDefault()
                                            void run(async () => {
                                                const updated = await renameTeam(editionId, team.id, renaming.name.trim())
                                                setTeams((list) => sortByName((list ?? []).map((row) => (row.id === team.id ? updated : row))))
                                                setRenaming(null)
                                            })
                                        }}
                                    >
                                        <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={40} className={`${INPUT_CLASS} min-w-0 flex-1`} />
                                        <button type="submit" disabled={busy || !renaming.name.trim()} className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}>OK</button>
                                        <button type="button" onClick={() => setRenaming(null)} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>×</button>
                                    </form>
                                ) : (
                                    <>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-zinc-100">{team.name}</span>
                                            <span className="block truncate text-xs text-zinc-500">{team.organization_name}</span>
                                        </span>
                                        <button type="button" onClick={() => setRenaming({ id: team.id, name: team.name })} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>
                                            Renomear
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void run(async () => {
                                                await removeTeam(editionId, team.id)
                                                setTeams((list) => (list ?? []).filter((row) => row.id !== team.id))
                                            })}
                                            aria-label={`Tirar ${team.name} da edição`}
                                            className={`${SMALL_BUTTON} text-zinc-500 hover:bg-red-950/50 hover:text-red-200`}
                                        >
                                            ×
                                        </button>
                                    </>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>
        </section>
    )
}
