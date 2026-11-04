import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function RegisterPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [nickname, setNickname] = useState('')
    const [fullName, setFullName] = useState('')
    const [ra, setRa] = useState('')
    const [cpf, setCpf] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)

        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            setIsSubmitting(false)
            return
        }

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    nickname,
                    fullName: fullName.trim() || null,
                    ra: ra.trim() || null,
                    cpf: cpf.trim() || null,
                }),
            })

            if (!response.ok) {
                const message = await response.text()
                throw new Error(message || 'Não foi possível criar a conta. Verifique os dados e tente novamente.')
            }

            navigate('/login', { replace: true })
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar a conta. Tente novamente mais tarde.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl items-center py-4">
            <div className="w-full rounded-3xl border border-red-950/50 bg-black/65 p-6 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="mb-6 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">Leu</p>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Criar conta</h1>
                    <p className="text-sm text-zinc-400">Crie uma conta para acessar algumas funcionalidades.</p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">Apelido</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="text"
                            autoComplete="name"
                            value={nickname}
                            onChange={(event) => setNickname(event.target.value)}
                            placeholder="Como quer aparecer"
                            required
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">Nome completo (opcional)</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="text"
                            autoComplete="name"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Nome completo"
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">E-mail</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="name@dac.unicamp.br"
                            required
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">RA (opcional)</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="text"
                            inputMode="numeric"
                            value={ra}
                            onChange={(event) => setRa(event.target.value)}
                            placeholder="6 dígitos"
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">CPF (opcional)</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="text"
                            inputMode="numeric"
                            value={cpf}
                            onChange={(event) => setCpf(event.target.value)}
                            placeholder="11 dígitos"
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">Senha</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Choose a password"
                            required
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-zinc-200">Confirmar Senha</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Confirm your password"
                            required
                        />
                    </label>

                    {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

                    <button
                        type="submit"
                        className="w-full rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Criando conta...' : 'Criar conta'}
                    </button>
                </form>

                <p className="mt-5 text-sm text-zinc-400">
                    Já tem conta?{' '}
                    <button
                        type="button"
                        className="font-medium text-red-300 transition hover:text-red-200"
                        onClick={() => {
                            const redirect = searchParams.get('redirect')
                            const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
                            navigate(`/login${query}`)
                        }}
                    >
                        Ir para o login
                    </button>
                </p>
            </div>
        </div>
    )
}
