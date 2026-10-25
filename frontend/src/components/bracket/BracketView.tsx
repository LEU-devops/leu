import { useState } from 'react'
import { getToken } from '../../services/auth'
import { stageLabel, type BracketMatch } from '../../types/competition'
import BracketLayout, { type BracketRound } from './BracketLayout'
import MatchResultDialog from './MatchResultDialog'
import TeamLogo from './TeamLogo'

function TeamRow({ name, score, isWinner }: { name: string | null; score: string | null; isWinner: boolean }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 ${isWinner ? 'bg-red-950/40 text-zinc-50' : 'text-zinc-300'}`}>
            {name ? <TeamLogo name={name} /> : <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-white/15" />}
            <span className={`flex-1 truncate text-sm ${name ? '' : 'italic text-zinc-500'} ${isWinner ? 'font-semibold' : ''}`}>
                {name ?? 'A definir'}
            </span>
            {score !== null ? <span className="shrink-0 text-sm font-semibold tabular-nums">{score}</span> : null}
        </div>
    )
}

function MatchCard({ match, onClick }: { match: BracketMatch; onClick?: () => void }) {
    const rows = (
        <>
            <TeamRow name={match.team_a_name} score={match.score_a} isWinner={match.winner_id !== null && match.winner_id === match.team_a_id} />
            <div className="border-t border-white/10" />
            <TeamRow name={match.team_b_name} score={match.score_b} isWinner={match.winner_id !== null && match.winner_id === match.team_b_id} />
            {match.status === 'live' ? (
                <p className="border-t border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Ao vivo</p>
            ) : null}
        </>
    )
    const className = 'w-56 overflow-hidden rounded-xl border border-white/10 bg-black/65 text-left shadow-lg shadow-black/30'

    if (!onClick) return <div className={className}>{rows}</div>
    return (
        <button type="button" onClick={onClick} className={`${className} cursor-pointer transition hover:border-red-800/70 focus-visible:border-red-600 focus-visible:outline-none`}>
            {rows}
        </button>
    )
}

interface Props {
    matches: BracketMatch[]
    /** Called with the updated bracket after a result is set or cleared. */
    onChange?: (matches: BracketMatch[]) => void
}

export default function BracketView({ matches, onChange }: Props) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const canEdit = Boolean(getToken()) && onChange !== undefined

    const totalRounds = Math.max(...matches.map((m) => m.round))
    const size = 2 ** totalRounds

    // Cells are indexed by position; a first-round position without a match is a bye.
    const rounds: BracketRound[] = []
    for (let round = 1; round <= totalRounds; round++) {
        const byPosition = new Map(matches.filter((m) => m.round === round).map((m) => [m.position, m]))
        rounds.push({
            label: stageLabel(totalRounds - round),
            cells: Array.from({ length: size / 2 ** round }, (_, position) => {
                const match = byPosition.get(position)
                if (!match) return null
                const isEditable = canEdit && match.team_a_id !== null && match.team_b_id !== null
                return <MatchCard key={match.id} match={match} onClick={isEditable ? () => setEditingId(match.id) : undefined} />
            }),
        })
    }

    const editing = matches.find((m) => m.id === editingId) ?? null

    return (
        <>
            {canEdit ? <p className="mb-3 text-sm text-zinc-500">Clique em uma partida para dar ou alterar o resultado.</p> : null}
            <BracketLayout rounds={rounds} />
            {editing && onChange ? (
                <MatchResultDialog
                    key={editing.id}
                    match={editing}
                    nextMatch={matches.find((m) => m.id === editing.next_match_id) ?? null}
                    stage={stageLabel(totalRounds - editing.round)}
                    onClose={() => setEditingId(null)}
                    onChange={onChange}
                />
            ) : null}
        </>
    )
}
