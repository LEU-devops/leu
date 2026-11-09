import { useEffect, useState } from 'react'
import { searchUsers } from '../services/organizations'
import type { UserSearchResult } from '../types/organizations'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'

export function UserAvatar({ name, photo }: { name: string, photo: string | null }) {
    const [failed, setFailed] = useState(false)
    if (photo && !failed) {
        return (
            <img
                src={`${import.meta.env.VITE_API_URL}${photo}`}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                onError={() => setFailed(true)}
            />
        )
    }
    return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 ring-1 ring-white/10">
            {name.slice(0, 2).toUpperCase()}
        </span>
    )
}

/** Search box listing users to pick; `isTaken` greys out (with `takenLabel`) users already chosen. */
export function UserSearch({ isTaken, onPick, takenLabel = 'Já é membro', placeholder = 'Buscar por nome, apelido ou e-mail' }: {
    isTaken: (email: string) => boolean
    onPick: (user: UserSearchResult) => void
    takenLabel?: string
    placeholder?: string
}) {
    const [query, setQuery] = useState('')
    /** Latest results and the term they answer; while it differs from the typed term, a search is pending. */
    const [response, setResponse] = useState<{ term: string, rows: UserSearchResult[] }>({ term: '', rows: [] })
    const term = query.trim()
    const searching = response.term !== term
    const results = term.length >= 2 ? response.rows : []

    useEffect(() => {
        if (term.length < 2)
            return
        let cancelled = false
        const timer = setTimeout(() => {
            searchUsers(term)
                .then((rows) => !cancelled && setResponse({ term, rows }))
                .catch(() => !cancelled && setResponse({ term, rows: [] }))
        }, 300)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [term])

    return (
        <div className="space-y-2">
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className={INPUT_CLASS}
            />
            {term.length >= 2 ? (
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-1">
                    {searching && results.length === 0 ? <li className="px-3 py-2 text-sm text-zinc-500">Buscando...</li> : null}
                    {!searching && results.length === 0 ? <li className="px-3 py-2 text-sm text-zinc-500">Nenhum usuário encontrado.</li> : null}
                    {results.map((user) => {
                        const taken = isTaken(user.email)
                        return (
                            <li key={user.email}>
                                <button
                                    type="button"
                                    disabled={taken}
                                    onClick={() => {
                                        onPick(user)
                                        setQuery('')
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <UserAvatar name={user.name} photo={user.profile_photo_url} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-zinc-100">{user.full_name || user.name}</span>
                                        <span className="block truncate text-xs text-zinc-500">{user.email}</span>
                                    </span>
                                    {taken ? <span className="text-xs text-zinc-500">{takenLabel}</span> : null}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            ) : null}
        </div>
    )
}
