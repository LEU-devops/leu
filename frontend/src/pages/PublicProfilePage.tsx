import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import ProfileBadges from '../components/badges/ProfileBadges'
import Timeline from '../components/Timeline'
import ProfileParticipations from '../components/participations/ProfileParticipations'
import { UserAvatar } from '../components/UserSearch'
import { getLoggedUser } from '../services/auth'
import { getPublicProfile } from '../services/sports'
import type { PublicProfile } from '../types/sports'

/** Public profile of anyone: photo, names and badges. */
export default function PublicProfilePage() {
    const email = useParams().email ?? ''
    const isMe = getLoggedUser()?.email === email

    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [loadedFor, setLoadedFor] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const loading = loadedFor !== email

    useEffect(() => {
        let cancelled = false
        getPublicProfile(email)
            .then((data) => {
                if (cancelled)
                    return
                setProfile(data)
                setError(null)
            })
            .catch(() => {
                if (cancelled)
                    return
                setProfile(null)
                setError('Pessoa não encontrada.')
            })
            .finally(() => {
                if (!cancelled)
                    setLoadedFor(email)
            })
        return () => {
            cancelled = true
        }
    }, [email])

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            {loading ? <Loading /> : null}
            {!loading && error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {!loading && profile ? (
                <div className="mx-auto max-w-4xl space-y-8">
                    <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-black/40 p-5">
                        <span className="[&>*]:h-20 [&>*]:w-20 [&>*]:text-xl">
                            <UserAvatar name={profile.nickname} photo={profile.profile_photo_url} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Perfil</p>
                            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">{profile.nickname}</h1>
                            {profile.full_name ? <p className="truncate text-sm text-zinc-400">{profile.full_name}</p> : null}
                        </div>
                        {isMe ? (
                            <Link to="/perfil" className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10">
                                Editar perfil
                            </Link>
                        ) : null}
                    </header>

                    <ProfileBadges profile={profile} />

                    <section className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">Trajetória</h2>
                            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                        </div>
                        <Timeline profile={profile} />
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">Campeonatos</h2>
                            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                            <span className="text-xs tabular-nums text-zinc-500">{profile.participations.length}</span>
                        </div>
                        <ProfileParticipations profile={profile} />
                    </section>
                </div>
            ) : null}
        </main>
    )
}
