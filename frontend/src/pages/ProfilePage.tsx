import { ChangeEvent, useEffect, useId, useState } from 'react'
import { getDisplayName, getLoggedUser, getMyProfile, type UserProfile, updateMyProfile, uploadMyProfilePhoto } from '../services/auth'
import Loading from '../components/Loading'

export default function ProfilePage() {
    const user = getLoggedUser()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [nickname, setNickname] = useState('')
    const [fullName, setFullName] = useState('')
    const [ra, setRa] = useState('')
    const [cpf, setCpf] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const photoInputId = useId()

    useEffect(() => {
        if (!user) {
            setLoading(false)
            return
        }

        let cancelled = false
        getMyProfile()
            .then((data) => {
                if (cancelled)
                    return
                setProfile(data)
                setNickname(data.nickname)
                setFullName(data.full_name ?? '')
                setRa(data.ra ?? '')
                setCpf(data.cpf ?? '')
            })
            .catch(() => {
                if (!cancelled)
                    setError('Não foi possível carregar o perfil.')
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [user?.email])

    async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const updated = await updateMyProfile({
                nickname,
                fullName: fullName.trim() || null,
                ra: ra.trim() || null,
                cpf: cpf.trim() || null,
            })
            setProfile(updated)
            setNickname(updated.nickname)
            setFullName(updated.full_name ?? '')
            setRa(updated.ra ?? '')
            setCpf(updated.cpf ?? '')
            setSuccess('Perfil atualizado com sucesso.')
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Falha ao salvar perfil.'
            setError(message)
        } finally {
            setSaving(false)
        }
    }

    async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file)
            return

        setError(null)
        setSuccess(null)
        setSaving(true)

        try {
            const updated = await uploadMyProfilePhoto(file)
            setProfile(updated)
            setSuccess('Foto de perfil atualizada.')
        } catch (uploadError) {
            const message = uploadError instanceof Error ? uploadError.message : 'Falha no upload da foto.'
            setError(message)
        } finally {
            setSaving(false)
            event.target.value = ''
        }
    }

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Conta</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Gerenciar Perfil</h1>
                <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    Edite suas informações pessoais e foto de perfil.
                </p>
            </div>

            {!user ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">Faça login para acessar seu perfil.</p> : null}
            {loading ? <Loading /> : null}

            {!loading && user && profile ? (
                <form onSubmit={saveProfile} className="max-w-2xl space-y-4 rounded-3xl border border-white/10 bg-black/40 p-5">
                    <div className="flex items-center gap-4">
                        <label htmlFor={photoInputId} className="group relative block h-16 w-16 cursor-pointer">
                            {profile.profile_photo_url ? (
                                <img
                                    src={`${import.meta.env.VITE_API_URL}${profile.profile_photo_url}`}
                                    alt="Foto de perfil"
                                    className="h-16 w-16 rounded-full object-cover"
                                />
                            ) : (
                                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-700/80 text-lg font-semibold text-white">
                                    {getDisplayName(profile).slice(0, 2).toUpperCase()}
                                </span>
                            )}

                            <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-full bg-black/55 group-hover:flex group-focus-within:flex">
                                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-white">
                                    <path
                                        fill="currentColor"
                                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a.996.996 0 0 0 0-1.41L18.37 3.29a.996.996 0 1 0-1.41 1.41l2.34 2.34c.39.39 1.03.39 1.41 0"
                                    />
                                </svg>
                            </span>
                        </label>
                        <label className="block text-sm text-zinc-300">
                            <span className="mb-2 block font-medium">Foto de perfil</span>
                            <input
                                id={photoInputId}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={changePhoto}
                                className="block cursor-pointer"
                            />
                        </label>
                    </div>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">E-mail</span>
                        <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-400" value={profile.email} disabled />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">Apelido</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition focus:border-red-600"
                            value={nickname}
                            onChange={(event) => setNickname(event.target.value)}
                            required
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">Nome completo</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition focus:border-red-600"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">RA (6 dígitos)</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition focus:border-red-600"
                            value={ra}
                            onChange={(event) => setRa(event.target.value)}
                            inputMode="numeric"
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">CPF</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition focus:border-red-600"
                            value={cpf}
                            onChange={(event) => setCpf(event.target.value)}
                            inputMode="numeric"
                        />
                    </label>

                    {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
                    {success ? <p className="rounded-2xl border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">{success}</p> : null}

                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                    >
                        {saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                </form>
            ) : null}
        </main>
    )
}
