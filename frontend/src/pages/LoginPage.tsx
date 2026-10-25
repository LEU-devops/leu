import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { storeToken } from '../services/auth'

type LoginResponse = {
    token: string
}

export default function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
                throw new Error('E-mail ou senha incorretos')
            }

            const data = (await response.json()) as LoginResponse
            storeToken(data.token)
            navigate('/home', { replace: true })
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Não foi possível realizar o login. Tente novamente mais tarde.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl items-center py-4">
            <div className="w-full rounded-3xl border border-red-950/50 bg-black/65 p-6 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="mb-6 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">Leu</p>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Login</h1>
                    <p className="text-sm text-zinc-400">Acesse informações privadas do seu perfil.</p>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
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
                        <span className="text-sm font-medium text-zinc-200">Senha</span>
                        <input
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-red-600 focus:bg-white/8"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Your password"
                            required
                        />
                    </label>

                    {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

                    <button
                        type="submit"
                        className="w-full rounded-2xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <p className="mt-5 text-sm text-zinc-400">
                    Ainda não tem conta?{' '}
                    <button type="button" className="font-medium text-red-300 transition hover:text-red-200" onClick={() => navigate('/register')}>
                        Criar uma conta
                    </button>
                </p>
            </div>
        </div>
    )
}
