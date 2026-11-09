import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getDisplayName, getLoggedUser, getToken } from '../services/auth'
import { getOrganizations } from '../services/competition'
import type { OrganizationHierarchy, OrganizationMember } from '../types/organizations'

const publicLinks = [
    { to: '/home', label: 'Home' },
    { to: '/entidades', label: 'Entidades' },
    { to: '/chaveamentos', label: 'Chaveamentos' },
    { to: '/tabela', label: 'Tabela' },
    { to: '/atletismo', label: 'Atletismo' },
    { to: '/natacao', label: 'Natação' },
    { to: '/pontuacao', label: 'Máx e Mín' },
]

/** Only offered when logged in; the admin routes themselves require the management permission. */
const adminLinks = [{ to: '/admin', label: 'Admin' }]

interface ManageOrganizationItem {
    id: number
    name: string
    members: boolean
    identity: boolean
}

function profileInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0)
        return 'U'
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function isDirectorOf(member: OrganizationMember, area: string): boolean {
    return member.role === 'diretor' && (member.director_area ?? '').trim().toLowerCase() === area
}

/** Mirrors the backend rules: presidents and secretaries manage members; presidents and marketing manage the identity. */
function canManageMembers(member: OrganizationMember): boolean {
    return member.role === 'presidente' || isDirectorOf(member, 'secretaria')
}

function canManageIdentity(member: OrganizationMember): boolean {
    return member.role === 'presidente' || isDirectorOf(member, 'marketing')
}

function organizationsToManage(organizations: OrganizationHierarchy[], userEmail: string): ManageOrganizationItem[] {
    return organizations
        .map((organization) => {
            const positions = organization.members.filter((member) => member.email === userEmail)
            return {
                id: organization.id,
                name: organization.name,
                members: positions.some(canManageMembers),
                identity: positions.some(canManageIdentity),
            }
        })
        .filter((item) => item.members || item.identity)
}

export default function AppLayout() {
    const navigate = useNavigate()
    const location = useLocation()

    const links = getToken() ? [...publicLinks, ...adminLinks] : publicLinks
    const user = getLoggedUser()
    const displayName = user ? getDisplayName(user) : null
    const profileButtonName = user?.nickname ?? null

    const [menuOpen, setMenuOpen] = useState(false)
    const [manageOrgs, setManageOrgs] = useState<ManageOrganizationItem[]>([])
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!user) {
            setManageOrgs([])
            return
        }

        let cancelled = false
        getOrganizations()
            .then((organizations) => {
                if (cancelled)
                    return
                setManageOrgs(organizationsToManage(organizations, user.email))
            })
            .catch(() => {
                if (!cancelled)
                    setManageOrgs([])
            })

        return () => {
            cancelled = true
        }
    }, [user?.email])

    useEffect(() => {
        setMenuOpen(false)
    }, [location.pathname, location.search])

    useEffect(() => {
        if (!menuOpen)
            return

        function handleClickOutside(event: MouseEvent) {
            if (!menuRef.current)
                return
            if (event.target instanceof Node && !menuRef.current.contains(event.target))
                setMenuOpen(false)
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape')
                setMenuOpen(false)
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [menuOpen])

    const redirectTarget = useMemo(() => {
        const current = `${location.pathname}${location.search}${location.hash}`
        return `/login?redirect=${encodeURIComponent(current)}`
    }, [location.pathname, location.search, location.hash])

    function onProfileClick() {
        if (!user) {
            navigate(redirectTarget)
            return
        }
        setMenuOpen((open) => !open)
    }
    console.log(user)
    return (
        <div className="relative z-10 flex min-h-screen flex-col">
            <header className="sticky top-0 z-20 border-b border-white/10 bg-black/65 backdrop-blur">
                <div className="flex h-14 items-center gap-6 px-4 md:px-8">
                    <NavLink to="/home" className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">
                        Leu
                    </NavLink>

                    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                        {links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) =>
                                    `shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition ${
                                        isActive ? 'bg-red-950/50 text-zinc-50' : 'text-zinc-300 hover:bg-white/5'
                                    }`
                                }
                            >
                                {link.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div ref={menuRef} className="relative">
                        <button
                            type="button"
                            onClick={onProfileClick}
                            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition hover:bg-white/10"
                        >
                            {user?.profile_photo_url ? (
                                <img
                                    src={`${import.meta.env.VITE_API_URL}${user.profile_photo_url}`}
                                    alt="Foto de perfil"
                                    className="h-8 w-8 rounded-full object-cover"
                                />
                            ) : (
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-700/80 text-xs font-semibold text-white">
                                    {user && profileButtonName ? profileInitials(profileButtonName) : '→'}
                                </span>
                            )}
                            <span className="hidden max-w-[10rem] truncate text-sm text-zinc-200 sm:block">
                                {user && profileButtonName ? profileButtonName : 'Fazer Login'}
                            </span>
                        </button>

                        {user && menuOpen ? (
                            <div className="absolute right-0 top-12 w-64 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl shadow-black/50">
                                <div className="px-2 py-1.5">
                                    <p className="truncate text-sm font-semibold text-zinc-100">{displayName}</p>
                                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                                </div>

                                <div className="my-1 h-px bg-white/10" />

                                <Link
                                    to="/perfil"
                                    className="block rounded-xl px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                                >
                                    Gerenciar Perfil
                                </Link>

                                {manageOrgs.flatMap((organization) => [
                                    organization.members ? (
                                        <Link
                                            key={`${organization.id}-members`}
                                            to={`/entidades/${organization.id}/membros`}
                                            className="block rounded-xl px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                                        >
                                            {organization.name}: Gerenciar Membros
                                        </Link>
                                    ) : null,
                                    organization.identity ? (
                                        <Link
                                            key={`${organization.id}-identity`}
                                            to={`/entidades/${organization.id}/identidade`}
                                            className="block rounded-xl px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                                        >
                                            {organization.name}: Gerenciar IV
                                        </Link>
                                    ) : null,
                                ])}
                            </div>
                        ) : null}
                    </div>
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
                <Outlet />
            </div>
        </div>
    )
}
