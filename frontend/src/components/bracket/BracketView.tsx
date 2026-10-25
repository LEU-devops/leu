import { stageLabel, type BracketMatch } from '../../types/competition'
import BracketLayout, { type BracketRound } from './BracketLayout'
import TeamLogo from './TeamLogo'

function TeamRow({ name, score, isWinner, placeholder }: { name: string | null; score: number | null; isWinner: boolean; placeholder: string }) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 ${isWinner ? 'bg-red-950/40 text-zinc-50' : 'text-zinc-300'}`}>
            {name ? <TeamLogo name={name} /> : <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-white/15" />}
            <span className={`flex-1 truncate text-sm ${name ? '' : 'italic text-zinc-500'} ${isWinner ? 'font-semibold' : ''}`}>
                {name ?? placeholder}
            </span>
            {score !== null ? <span className="w-6 text-right text-sm font-semibold tabular-nums">{score}</span> : null}
        </div>
    )
}

function MatchCard({ match }: { match: BracketMatch }) {
    const isWalkover = match.status === 'walkover'
    return (
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-black/65 shadow-lg shadow-black/30">
            <TeamRow
                name={match.team_a_name}
                score={match.score_a}
                isWinner={match.winner_id !== null && match.winner_id === match.team_a_id}
                placeholder="A definir"
            />
            <div className="border-t border-white/10" />
            <TeamRow
                name={match.team_b_name}
                score={match.score_b}
                isWinner={match.winner_id !== null && match.winner_id === match.team_b_id}
                placeholder={isWalkover ? 'Bye' : 'A definir'}
            />
            {match.status === 'live' ? (
                <p className="border-t border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Ao vivo</p>
            ) : null}
        </div>
    )
}

export default function BracketView({ matches }: { matches: BracketMatch[] }) {
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
                return match ? <MatchCard key={match.id} match={match} /> : null
            }),
        })
    }

    return <BracketLayout rounds={rounds} />
}
