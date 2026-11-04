import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import { getOrganization } from '../services/competition'
import type { OrganizationHierarchy, OrganizationMember } from '../types/organizations'

function OrganizationLogo({ name }: { name: string }) {
    const [hasError, setHasError] = useState(false)

    if (hasError) {
        return (
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-xs font-semibold text-zinc-300">
                {name.slice(0, 3).toUpperCase()}
            </span>
        )
    }

    return (
        <img
            src={`/logos/${name}.png`}
            alt={`Logo ${name}`}
            className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 bg-black/20 object-contain p-1"
            onError={() => setHasError(true)}
        />
    )
}

function roleBadge(member: OrganizationMember): string | null {
    if (member.role === 'presidente')
        return 'Presidente'
    if (member.role === 'vice')
        return 'Vice-presidente'
    if (member.role === 'diretor')
        return member.director_area?.trim() || 'Diretoria'
    return null
}

function memberInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0)
        return 'U'
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function MemberRow({ member }: { member: OrganizationMember }) {
    const badge = roleBadge(member)

    return (
        <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200">
            <div className="flex min-w-0 items-center gap-2.5">
                {member.profile_photo_url ? (
                    <img
                        src={`${import.meta.env.VITE_API_URL}${member.profile_photo_url}`}
                        alt={`Foto de ${member.name}`}
                        className="h-9 w-9 rounded-full object-cover"
                    />
                ) : (
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-zinc-200">
                        {memberInitials(member.name)}
                    </span>
                )}
                <span className="truncate">{member.name}</span>
            </div>

            {badge ? (
                <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">
                    {badge}
                </span>
            ) : null}
        </li>
    )
}

export default function OrganizationDetailPage() {
    const params = useParams()
    const id = Number(params.id)

    const [organization, setOrganization] = useState<OrganizationHierarchy | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!Number.isInteger(id) || id <= 0) {
            setError('Entidade inválida.')
            setLoading(false)
            return
        }

        let cancelled = false
        getOrganization(id)
            .then((data) => {
                if (!cancelled)
                    setOrganization(data)
            })
            .catch(() => {
                if (!cancelled)
                    setError('Não foi possível carregar a entidade.')
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [id])

    const sections = useMemo(() => {
        const members = organization?.members ?? []
        return {
            presidencia: members.filter((member) => member.role === 'presidente' || member.role === 'vice'),
            diretoria: members.filter((member) => member.role === 'diretor'),
            gestao: members.filter((member) => member.role === 'membro'),
        }
    }, [organization])

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div className="space-y-3">
                <Link to="/entidades" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                    <span aria-hidden>←</span>
                    Voltar para entidades
                </Link>

                {organization ? (
                    <header
                        className="flex items-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-4"
                        style={{ backgroundImage: `${organization.gradient}, radial-gradient(circle at top right, rgb(255 255 255 / 0.08), transparent 55%)` }}
                    >
                        <OrganizationLogo name={organization.name} />
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Entidade</p>
                            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{organization.name}</h1>
                            <p className="text-sm text-zinc-400">{organization.description || 'Sem descrição cadastrada.'}</p>
                        </div>
                    </header>
                ) : null}
            </div>

            {loading ? <Loading /> : null}
            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {!loading && !error && organization ? (
                <section className="grid gap-3 lg:grid-cols-2">
                    <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Presidência</h2>
                        {sections.presidencia.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                                {sections.presidencia.map((member) => (
                                    <MemberRow key={member.email} member={member} />
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 text-sm text-zinc-500">Nenhum membro cadastrado.</p>
                        )}
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Diretoria</h2>
                        {sections.diretoria.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                                {sections.diretoria.map((member) => (
                                    <MemberRow key={member.email} member={member} />
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 text-sm text-zinc-500">Nenhum diretor cadastrado.</p>
                        )}
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-black/30 p-4 lg:col-span-2">
                        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Gestão</h2>
                        {sections.gestao.length > 0 ? (
                            <ul className="mt-3 grid gap-2 md:grid-cols-2">
                                {sections.gestao.map((member) => (
                                    <MemberRow key={member.email} member={member} />
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 text-sm text-zinc-500">Nenhum membro de gestão cadastrado.</p>
                        )}
                    </article>
                </section>
            ) : null}
        </main>
    )
}
