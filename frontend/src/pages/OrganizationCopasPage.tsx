import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EditionSelect from '../components/EditionSelect'
import Loading from '../components/Loading'
import ParticipationCard from '../components/participations/ParticipationCard'
import { editionLabel, useEdition } from '../contexts/edition'
import { getOrganization } from '../services/competition'
import { getOrganizationPermissions } from '../services/organizations'
import { getCopaEntries, getSportsTeams } from '../services/sports'
import type { OrganizationHierarchy } from '../types/organizations'
import type { Athlete, Participation, SportsTeam } from '../types/sports'

function entryKey(entry: Participation): string {
    return `${entry.modality?.code}|${entry.copa_team?.id}`
}

/**
 * An AAA in the LEU Copas: one card per modality it plays in the selected edition, with the result
 * straight from the Copa. The sports board picks who played and gives individual awards.
 */
export default function OrganizationCopasPage() {
    const params = useParams()
    const id = Number(params.id)
    const invalidId = !Number.isInteger(id) || id <= 0
    const { edition } = useEdition()

    const [organization, setOrganization] = useState<OrganizationHierarchy | null>(null)
    const [teams, setTeams] = useState<SportsTeam[]>([])
    const [canManage, setCanManage] = useState(false)
    const [loaded, setLoaded] = useState<{ editionId: number, entries: Participation[] } | null>(null)
    const [error, setError] = useState<string | null>(invalidId ? 'Entidade inválida.' : null)

    useEffect(() => {
        if (invalidId)
            return
        let cancelled = false
        Promise.all([getOrganization(id), getOrganizationPermissions(id), getSportsTeams(id)])
            .then(([org, permissions, teamList]) => {
                if (cancelled)
                    return
                setOrganization(org)
                setCanManage(permissions.canManageSports)
                setTeams(teamList)
            })
            .catch(() => !cancelled && setError('Não foi possível carregar a entidade.'))
        return () => {
            cancelled = true
        }
    }, [id, invalidId])

    useEffect(() => {
        if (invalidId || !edition)
            return
        let cancelled = false
        getCopaEntries(id, edition.id)
            .then((entries) => !cancelled && setLoaded({ editionId: edition.id, entries }))
            .catch(() => !cancelled && setError('Não foi possível carregar as modalidades da Copa.'))
        return () => {
            cancelled = true
        }
    }, [id, invalidId, edition])

    const entries = loaded && loaded.editionId === edition?.id ? loaded.entries : null

    /** Athletes of all the AAA's teams, offered when its team of the same name does not exist. */
    const allAthletes = useMemo(() => {
        const byEmail = new Map<string, Athlete>()
        for (const team of teams)
            for (const member of team.members)
                if (member.is_athlete) byEmail.set(member.email, member)
        return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    }, [teams])

    /** The roster of the AAA's team named like the modality (e.g. "Futsal Masculino"), else every athlete. */
    function suggestionsFor(entry: Participation): Athlete[] {
        const name = entry.modality?.name.trim().toLowerCase()
        const team = teams.find((row) => row.name.trim().toLowerCase() === name)
        return team ? team.members.filter((member) => member.is_athlete) : allAthletes
    }

    function replace(updated: Participation) {
        setLoaded((current) => current && {
            ...current,
            entries: current.entries.map((entry) => (entryKey(entry) === entryKey(updated) ? updated : entry)),
        })
    }

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <Link to={`/entidades/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                <span aria-hidden>←</span>
                Voltar para a entidade
            </Link>

            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {organization ? (
                <div className="mx-auto max-w-4xl space-y-6">
                    <header className="space-y-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{organization.name}</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Copas da LEU</h1>
                            <p className="text-sm text-zinc-400">
                                Modalidades em que a {organization.name} joga em cada edição. O resultado vem direto da Copa (chaveamento ou provas)
                                {canManage ? '; aqui a diretoria de Esportes informa quem jogou e dá premiações individuais.' : '.'}
                            </p>
                        </div>
                        <EditionSelect />
                    </header>

                    {entries === null && !error ? <Loading /> : null}
                    {entries?.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                            A {organization.name} não está em nenhuma chave ou inscrição {edition ? `da ${editionLabel(edition)}` : 'desta edição'}.
                            {canManage ? ' Se deveria estar, confira com a administração da Copa se ela está entre os times da edição.' : ''}
                        </p>
                    ) : null}

                    <div className="space-y-3">
                        {entries?.map((entry) => (
                            <ParticipationCard
                                key={entryKey(entry)}
                                participation={entry}
                                canEdit={canManage}
                                suggestions={suggestionsFor(entry)}
                                onChange={replace}
                            />
                        ))}
                    </div>
                </div>
            ) : !error ? <Loading /> : null}
        </main>
    )
}
