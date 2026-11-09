import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import { getOrganizations } from '../services/competition'
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

function memberInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0)
        return 'U'
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

type AvatarSize = 'lg' | 'md' | 'sm'

const AVATAR_SIZES: Record<AvatarSize, { box: string, initials: string, label: string }> = {
    lg: { box: 'h-36 w-36 md:h-40 md:w-40', initials: 'text-3xl', label: 'pb-4 pt-6 text-sm' },
    md: { box: 'h-28 w-28 md:h-32 md:w-32', initials: 'text-2xl', label: 'pb-3 pt-5 text-xs' },
    sm: { box: 'h-24 w-24 md:h-28 md:w-28', initials: 'text-xl', label: 'pb-2.5 pt-4 text-[11px]' },
}

function MemberAvatar({ member, size, caption }: { member: OrganizationMember, size: AvatarSize, caption?: string | null }) {
    const [photoError, setPhotoError] = useState(false)
    const styles = AVATAR_SIZES[size]
    const showPhoto = Boolean(member.profile_photo_url) && !photoError

    return (
        <li className="group flex flex-col items-center gap-2">
            <div
                className={`relative ${styles.box} overflow-hidden rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-lg shadow-black/40 ring-2 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:ring-white/30`}
            >
                {showPhoto ? (
                    <img
                        src={`${import.meta.env.VITE_API_URL}${member.profile_photo_url}`}
                        alt={`Foto de ${member.name}`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={() => setPhotoError(true)}
                    />
                ) : (
                    <span className={`flex h-full w-full items-center justify-center pb-4 font-semibold text-zinc-300 ${styles.initials}`}>
                        {memberInitials(member.name)}
                    </span>
                )}

                <div
                    className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-4 text-center backdrop-blur-[2px] ${styles.label}`}
                >
                    <span className="block truncate font-semibold text-white drop-shadow" title={member.name}>
                        {member.name}
                    </span>
                </div>
            </div>

            {caption ? (
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{caption}</span>
            ) : null}
        </li>
    )
}

function SectionHeading({ title, count }: { title: string, count: number }) {
    return (
        <div className="flex items-center gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">{title}</h2>
            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
            <span className="text-xs tabular-nums text-zinc-500">{count}</span>
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">{text}</p>
}

export default function OrganizationDetailPage() {
    const params = useParams()
    const id = Number(params.id)

    const [organization, setOrganization] = useState<OrganizationHierarchy | null>(null)
    const [associations, setAssociations] = useState<OrganizationHierarchy[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!Number.isInteger(id) || id <= 0) {
            setError('Entidade inválida.')
            setLoading(false)
            return
        }

        let cancelled = false
        getOrganizations()
            .then((data) => {
                if (cancelled)
                    return
                const current = data.find((row) => row.id === id)
                if (!current) {
                    setError('Entidade não encontrada.')
                    return
                }
                setOrganization(current)
                setAssociations(current.name === 'LEU' ? data.filter((row) => row.id !== id) : [])
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

        const directorsByArea = new Map<string, OrganizationMember[]>()
        for (const member of members) {
            if (member.role !== 'diretor')
                continue
            const area = member.director_area?.trim() || 'Outras áreas'
            const list = directorsByArea.get(area) ?? []
            list.push(member)
            directorsByArea.set(area, list)
        }

        const diretoria = [...directorsByArea.entries()]
            .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
            .map(([area, list]) => ({ area, members: list }))

        return {
            presidencia: members
                .filter((member) => member.role === 'presidente' || member.role === 'vice')
                .sort((a, b) => (a.role === b.role ? 0 : a.role === 'presidente' ? -1 : 1)),
            diretoria,
            diretoriaCount: diretoria.reduce((total, group) => total + group.members.length, 0),
            conselho: members.filter((member) => member.role === 'conselheiro'),
            gestao: members.filter((member) => member.role === 'membro'),
            diretoriaInterna: associations
                .map((association) => ({
                    id: association.id,
                    name: association.name,
                    members: association.members
                        .filter((member) => member.role === 'presidente' || member.role === 'vice')
                        .sort((a, b) => (a.role === b.role ? 0 : a.role === 'presidente' ? -1 : 1)),
                }))
                .filter((association) => association.members.length > 0),
        }
    }, [organization, associations])

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
                <div className="mx-auto max-w-6xl space-y-12 pt-2">
                    <section className="space-y-6">
                        <SectionHeading title="Presidência" count={sections.presidencia.length} />
                        {sections.presidencia.length > 0 ? (
                            <ul className="flex flex-wrap justify-center gap-x-10 gap-y-6">
                                {sections.presidencia.map((member) => (
                                    <MemberAvatar
                                        key={member.email}
                                        member={member}
                                        size="lg"
                                        caption={member.role === 'presidente' ? 'Presidente' : 'Vice-presidente'}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <EmptyState text="Nenhum membro cadastrado." />
                        )}
                    </section>

                    <section className="space-y-6">
                        <SectionHeading title="Diretoria" count={sections.diretoriaCount} />
                        {sections.diretoria.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-x-20 gap-y-12">
                                {sections.diretoria.map((group) => (
                                    <article key={group.area} className="flex flex-col items-center">
                                        <h3 className="mb-5 text-center text-lg font-semibold tracking-tight text-zinc-100">{group.area}</h3>
                                        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-6">
                                            {group.members.map((member) => (
                                                <MemberAvatar key={member.email} member={member} size="md" />
                                            ))}
                                        </ul>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <EmptyState text="Nenhum diretor cadastrado." />
                        )}
                    </section>

                    <section className="space-y-6">
                        <SectionHeading title="Conselho" count={sections.conselho.length} />
                        {sections.conselho.length > 0 ? (
                            <ul className="flex flex-wrap justify-center gap-x-8 gap-y-6">
                                {sections.conselho.map((member) => (
                                    <MemberAvatar key={member.email} member={member} size="md" />
                                ))}
                            </ul>
                        ) : (
                            <EmptyState text="Nenhum conselheiro cadastrado." />
                        )}
                    </section>

                    {sections.diretoriaInterna.length > 0 ? (
                        <section className="space-y-6">
                            <SectionHeading
                                title="Diretoria interna"
                                count={sections.diretoriaInterna.reduce((total, association) => total + association.members.length, 0)}
                            />
                            <div className="flex flex-wrap justify-center gap-5">
                                {sections.diretoriaInterna.map((association) => (
                                    <article
                                        key={association.id}
                                        className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 pb-6 pt-5"
                                    >
                                        <Link
                                            to={`/entidades/${association.id}`}
                                            className="mb-5 text-lg font-semibold tracking-tight text-zinc-100 transition hover:text-white"
                                        >
                                            {association.name}
                                        </Link>
                                        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-6">
                                            {association.members.map((member) => (
                                                <MemberAvatar
                                                    key={member.email}
                                                    member={member}
                                                    size="md"
                                                    caption={member.role === 'presidente' ? 'Presidente' : 'Vice-presidente'}
                                                />
                                            ))}
                                        </ul>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="space-y-6">
                        <SectionHeading title="Gestão" count={sections.gestao.length} />
                        {sections.gestao.length > 0 ? (
                            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-6">
                                {sections.gestao.map((member) => (
                                    <MemberAvatar key={member.email} member={member} size="sm" />
                                ))}
                            </ul>
                        ) : (
                            <EmptyState text="Nenhum membro de gestão cadastrado." />
                        )}
                    </section>
                </div>
            ) : null}
        </main>
    )
}
