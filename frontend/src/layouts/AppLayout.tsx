import { NavLink, Outlet } from 'react-router-dom'

const links = [
    { to: '/home', label: 'Home' },
    { to: '/chaveamentos', label: 'Chaveamentos' },
    { to: '/tabela', label: 'Tabela' },
]

export default function AppLayout() {
    return (
        <div className="relative z-10 flex min-h-screen flex-col">
            <header className="sticky top-0 z-20 border-b border-white/10 bg-black/65 backdrop-blur">
                <div className="flex h-14 items-center gap-6 px-4 md:px-8">
                    <NavLink to="/home" className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">
                        Leu
                    </NavLink>

                    <nav className="flex items-center gap-1">
                        {links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) =>
                                    `rounded-xl px-3 py-1.5 text-sm transition ${
                                        isActive ? 'bg-red-950/50 text-zinc-50' : 'text-zinc-300 hover:bg-white/5'
                                    }`
                                }
                            >
                                {link.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
                <Outlet />
            </div>
        </div>
    )
}
