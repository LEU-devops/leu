import { useEffect, useState } from 'react'
import Loading from '../Loading'
import Select from '../Select'
import { getOrganizations, getTeams, setTeamOrganization } from '../../services/competition'
import type { Team } from '../../types/competition'
import type { OrganizationHierarchy } from '../../types/organizations'

/** Which AAA each Copa team is, so the AAA's sports board can register its athletes in the Copas. */
export default function CopaTeamsSection() {
    const [teams, setTeams] = useState<Team[] | null>(null)
    const [organizations, setOrganizations] = useState<OrganizationHierarchy[]>([])
    const [savingId, setSavingId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([getTeams(), getOrganizations()])
            .then(([teamList, organizationList]) => {
                setTeams(teamList)
                setOrganizations(organizationList)
            })
            .catch(() => setError('Não foi possível carregar os times.'))
    }, [])

    async function link(team: Team, organizationId: number) {
        setSavingId(team.id)
        setError(null)
        try {
            const updated = await setTeamOrganization(team.id, organizationId === 0 ? null : organizationId)
            setTeams((list) => (list ?? []).map((row) => (row.id === team.id ? { ...row, organization_id: updated.organization_id } : row)))
        } catch {
            setError('Não foi possível salvar o vínculo.')
        } finally {
            setSavingId(null)
        }
    }

    const options = [{ value: 0, label: 'Sem vínculo' }, ...organizations.map((org) => ({ value: org.id, label: org.name }))]

    return (
        <section className="rounded-3xl border border-white/10 bg-black/65 p-6 backdrop-blur">
            <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-50">Times da Copa e atléticas</h2>
                <p className="text-sm text-zinc-400">
                    Liga cada time das chaves à sua atlética. Com o vínculo, a diretoria de Esportes da atlética escolhe os atletas de cada modalidade e o resultado vai para o perfil deles.
                </p>
            </div>
            {error ? <p className="mb-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {teams === null && !error ? <Loading /> : null}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {teams?.map((team) => (
                    <li key={team.id} className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 ${savingId === team.id ? 'opacity-60' : ''}`}>
                        <span className="w-20 shrink-0 truncate text-sm font-semibold text-zinc-100">{team.name}</span>
                        <div className="min-w-0 flex-1">
                            <Select value={team.organization_id ?? 0} options={options} onChange={(value) => void link(team, value)} />
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
