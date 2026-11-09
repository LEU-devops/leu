import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading'
import OrganizationLogo from '../components/OrganizationLogo'
import { organizationBackground } from '../utils/gradient'
import { getOrganizations } from '../services/competition'
import type { OrganizationHierarchy } from '../types/organizations'

function sortOrganizations(input: OrganizationHierarchy[]): OrganizationHierarchy[] {
    return [...input].sort((a, b) => {
        if (a.name === 'LEU' && b.name !== 'LEU') return -1
        if (b.name === 'LEU' && a.name !== 'LEU') return 1
        return a.name.localeCompare(b.name, 'pt-BR')
    })
}

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<OrganizationHierarchy[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        getOrganizations()
            .then((data) => {
                if (!cancelled)
                    setOrganizations(data)
            })
            .catch(() => {
                if (!cancelled)
                    setError('Não foi possível carregar as entidades.')
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [])

    const organizationsSorted = useMemo(() => {
        return sortOrganizations(organizations)
    }, [organizations])

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Institucional</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Entidades</h1>
                <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                    Um card por atlética com informações básicas. Clique para abrir a página da entidade.
                </p>
            </div>

            {loading ? <Loading /> : null}
            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {!loading && !error ? (
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {organizationsSorted.map((organization) => {
                        const president = organization.members.find((member) => member.role === 'presidente')
                        const directors = organization.members.filter((member) => member.role === 'diretor').length

                        return (
                            <Link
                                key={organization.id}
                                to={`/entidades/${organization.id}`}
                                className="group rounded-3xl border border-white/10 bg-black/40 p-5 shadow-xl shadow-black/25 backdrop-blur transition hover:border-red-400/40 hover:bg-black/55"
                                style={{ backgroundImage: organizationBackground(organization.gradient) }}
                            >
                                <header className="flex items-center gap-3 border-b border-white/10 pb-4">
                                <OrganizationLogo organization={organization} className="h-12 w-12" />
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-100 transition group-hover:text-red-300">{organization.name}</h2>
                                    <p className="text-xs text-zinc-500">{organization.description || 'Sem descrição cadastrada.'}</p>
                                </div>
                                </header>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Membros</p>
                                        <p className="mt-1 font-semibold text-zinc-100">{organization.members.length}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Diretores</p>
                                        <p className="mt-1 font-semibold text-zinc-100">{directors}</p>
                                    </div>
                                </div>

                                <p className="mt-3 text-xs text-zinc-400">
                                    Presidente: <span className="text-zinc-200">{president?.name ?? 'Não definido'}</span>
                                </p>
                            </Link>
                        )
                    })}
                </section>
            ) : null}
        </main>
    )
}
