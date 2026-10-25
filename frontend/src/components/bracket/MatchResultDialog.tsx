import { useEffect, useState } from 'react'
import { clearMatchResult, setMatchResult } from '../../services/competition'
import type { BracketMatch } from '../../types/competition'
import TeamLogo from './TeamLogo'

type Side = 'a' | 'b'

/** Leading number of a free-text score ("2 (4)" → 2), or null when there is none. */
function leadingNumber(score: string): number | null {
    const match = score.trim().match(/^-?\d+(?:[.,]\d+)?/)
    return match ? parseFloat(match[0].replace(',', '.')) : null
}

function impliedWinner(scoreA: string, scoreB: string): Side | null {
    const a = leadingNumber(scoreA)
    const b = leadingNumber(scoreB)
    if (a === null || b === null || a === b) return null
    return a > b ? 'a' : 'b'
}

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para dar resultados.'
    const match = text.match(/"message":"([^"]+)"/)
    return match ? match[1] : 'Não foi possível salvar o resultado. Tente novamente.'
}

const INPUT_CLASS =
    'w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 disabled:opacity-50'

interface Props {
    match: BracketMatch
    /** The match the winner advances to, when there is one. */
    nextMatch: BracketMatch | null
    stage: string
    onClose: () => void
    onChange: (matches: BracketMatch[]) => void
}

export default function MatchResultDialog({ match, nextMatch, stage, onClose, onChange }: Props) {
    const isFinished = match.winner_id !== null
    const isLocked = nextMatch !== null && nextMatch.winner_id !== null

    // String() guards against databases migrated while scores were still integer columns.
    const [scoreA, setScoreA] = useState(String(match.score_a ?? ''))
    const [scoreB, setScoreB] = useState(String(match.score_b ?? ''))
    const [winner, setWinner] = useState<Side | null>(isFinished ? (match.winner_id === match.team_a_id ? 'a' : 'b') : null)
    // Once the user picks a winner by hand, the scores stop driving the toggle.
    const [isOverridden, setIsOverridden] = useState(isFinished)
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    function changeScore(side: Side, value: string) {
        const nextA = side === 'a' ? value : scoreA
        const nextB = side === 'b' ? value : scoreB
        if (side === 'a') setScoreA(value)
        else setScoreB(value)
        if (!isOverridden) setWinner(impliedWinner(nextA, nextB))
    }

    function pickWinner(side: Side) {
        setWinner(side)
        setIsOverridden(true)
    }

    async function run(action: () => Promise<BracketMatch[]>) {
        setError(null)
        setIsSaving(true)
        try {
            onChange(await action())
            onClose()
        } catch (actionError) {
            setError(errorMessage(actionError))
        } finally {
            setIsSaving(false)
        }
    }

    const teams: { side: Side; name: string }[] = [
        { side: 'a', name: match.team_a_name ?? '' },
        { side: 'b', name: match.team_b_name ?? '' },
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="match-result-title"
                className="w-full max-w-md rounded-3xl border border-red-950/50 bg-zinc-950 p-6 shadow-2xl shadow-black/60"
                onClick={(event) => event.stopPropagation()}
            >
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">{stage}</p>
                <h2 id="match-result-title" className="mb-5 text-2xl font-semibold tracking-tight text-zinc-50">
                    {isFinished ? 'Alterar resultado' : 'Resultado'}
                </h2>

                <div className="space-y-2">
                    {teams.map(({ side, name }) => {
                        const score = side === 'a' ? scoreA : scoreB
                        const isWinner = winner === side
                        return (
                            <div key={side} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${isWinner ? 'border-red-800/70 bg-red-950/30' : 'border-white/10 bg-white/5'}`}>
                                <TeamLogo name={name} className="h-9 w-9" />
                                <span className={`flex-1 truncate ${isWinner ? 'font-semibold text-zinc-50' : 'text-zinc-200'}`}>{name}</span>
                                <input
                                    className={INPUT_CLASS}
                                    value={score}
                                    placeholder="0"
                                    disabled={isLocked}
                                    aria-label={`Placar de ${name}`}
                                    onChange={(event) => changeScore(side, event.target.value)}
                                />
                            </div>
                        )
                    })}
                </div>

                <div className="mt-5">
                    <p className="mb-2 text-sm font-medium text-zinc-200">Vencedor</p>
                    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1" role="radiogroup" aria-label="Vencedor">
                        {teams.map(({ side, name }) => (
                            <button
                                key={side}
                                type="button"
                                role="radio"
                                aria-checked={winner === side}
                                disabled={isLocked}
                                onClick={() => pickWinner(side)}
                                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${
                                    winner === side ? 'bg-red-600 text-white' : 'text-zinc-300 hover:bg-white/5'
                                }`}
                            >
                                <TeamLogo name={name} className="h-5 w-5" />
                                <span className="truncate">{name}</span>
                            </button>
                        ))}
                    </div>
                    {!isOverridden && winner === null ? (
                        <p className="mt-2 text-xs text-zinc-500">Preencha os placares ou escolha o vencedor.</p>
                    ) : null}
                </div>

                {isLocked ? (
                    <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                        A próxima partida já foi resolvida. Desfaça o resultado dela antes de alterar esta.
                    </p>
                ) : null}
                {error ? <p className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLocked || isSaving || winner === null}
                        onClick={() => winner && run(() => setMatchResult(match.modality_code, match.id, { scoreA, scoreB, winner }))}
                    >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                    {isFinished ? (
                        <button
                            type="button"
                            className="rounded-xl border border-red-900/60 px-4 py-2 font-medium text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isLocked || isSaving}
                            onClick={() => run(() => clearMatchResult(match.modality_code, match.id))}
                        >
                            Desfazer resultado
                        </button>
                    ) : null}
                    <button type="button" className="ml-auto rounded-xl px-4 py-2 text-zinc-400 transition hover:text-zinc-200" onClick={onClose}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
