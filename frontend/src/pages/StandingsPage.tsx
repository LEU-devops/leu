import { useCallback, useEffect, useState } from 'react'
import Loading from '../components/Loading'
import StandingsTable from '../components/standings/StandingsTable'
import SummaryCards from '../components/standings/SummaryCards'
import { getToken } from '../services/auth'
import { getMatches, getStandings, setTeamScoring, type TeamScoringInput } from '../services/competition'
import type { ScheduledMatch } from '../types/competition'
import type { Standings } from '../types/standings'

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para alterar bônus e penalidades.'
    const match = text.match(/"message":"([^"]+)"/)
    return match ? match[1] : 'Não foi possível salvar. Tente novamente.'
}

export default function StandingsPage() {
    const [standings, setStandings] = useState<Standings | null>(null)
    const [matches, setMatches] = useState<ScheduledMatch[]>([])
    const [error, setError] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [savingTeamId, setSavingTeamId] = useState<number | null>(null)
    const canEdit = Boolean(getToken())

    useEffect(() => {
        let cancelled = false
        Promise.all([getStandings(), getMatches()])
            .then(([data, allMatches]) => {
                if (cancelled) return
                setStandings(data)
                setMatches(allMatches)
            })
            .catch(() => {
                if (!cancelled) setError('Não foi possível carregar a pontuação.')
            })
        return () => {
            cancelled = true
        }
    }, [])

    // Saves the change, then reloads the table so the totals come from the server.
    const changeScoring = useCallback(async (teamId: number, scoring: TeamScoringInput) => {
        setSaveError(null)
        setSavingTeamId(teamId)
        try {
            await setTeamScoring(teamId, scoring)
            setStandings(await getStandings())
        } catch (saveFailure) {
            setSaveError(errorMessage(saveFailure))
        } finally {
            setSavingTeamId(null)
        }
    }, [])

    const modalities = standings?.modalities ?? []
    const inProgress = modalities.filter((m) => m.team_count > 0 && !m.finished && !m.error).length
    const errors = modalities.filter((m) => m.error)

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Pontuação</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Máx e Mín</h1>
                <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    Pontos de cada time por modalidade. Enquanto a chave não termina, a célula mostra a faixa de pontos possível e a faixa de colocação.
                    {canEdit ? ' O bônus de torcida e a penalidade podem ser alterados direto na tabela.' : ''}
                </p>
            </div>

            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {saveError ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{saveError}</p> : null}
            {standings === null && !error ? <Loading /> : null}

            {standings ? (
                <>
                    <SummaryCards standings={standings} matches={matches} />

                    {standings.teams.length === 0 ? (
                        <p className="text-sm text-zinc-400">Nenhum time cadastrado.</p>
                    ) : (
                        <StandingsTable standings={standings} onScoringChange={canEdit ? changeScoring : undefined} savingTeamId={savingTeamId} />
                    )}

                    {errors.length > 0 ? (
                        <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                            {errors.map((m) => (
                                <p key={m.code}>
                                    <span className="font-semibold">{m.code}</span>: {m.error}
                                </p>
                            ))}
                        </div>
                    ) : null}

                    <dl className="grid gap-x-8 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
                        <div><dt className="inline font-semibold text-zinc-400">Faixa</dt><dd className="inline"> · pontuação mínima e máxima ainda possível; vira um só número quando a colocação fecha.</dd></div>
                        <div><dt className="inline font-semibold text-zinc-400">W.O.</dt><dd className="inline"> · derrota por W.O. mantém a colocação, mas não pontua.</dd></div>
                        <div><dt className="inline font-semibold text-zinc-400">Torcida e Pen.</dt><dd className="inline"> · bônus de 2 pontos e penalidade, somados ao total.</dd></div>
                        <div><dt className="inline font-semibold text-zinc-400">Máx e Mín</dt><dd className="inline"> · total ordenado pelo máximo. {inProgress > 0 ? `${inProgress} ${inProgress === 1 ? 'modalidade em andamento' : 'modalidades em andamento'}.` : 'Todas as modalidades encerradas.'}</dd></div>
                    </dl>
                </>
            ) : null}
        </main>
    )
}
