import { useState, type ReactNode } from 'react'
import { getToken } from '../../services/auth'
import { formatSchedule, stageLabel, type BracketMatch, type Team, type Venue } from '../../types/competition'
import BracketLayout, { type BracketRound } from './BracketLayout'
import MatchDialog from './MatchDialog'
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

function InfoLine({ children, muted, title }: { children: ReactNode; muted?: boolean; title?: string }) {
    return (
        <p className={`flex min-w-0 items-center gap-1 truncate text-[11px] leading-4 ${muted ? 'italic text-zinc-600' : 'text-zinc-400'}`} title={title}>
            {children}
        </p>
    )
}

function MatchCard({ match, venuePath, onClick }: { match: BracketMatch; venuePath: string | null; onClick?: () => void }) {
    const when = formatSchedule(match.scheduled_at)
    const content = (
        <>
            {/* Teams */}
            <div className="w-36 shrink-0">
                <TeamRow name={match.team_a_name} score={match.score_a} isWinner={match.winner_id !== null && match.winner_id === match.team_a_id} />
                <div className="border-t border-white/10" />
                <TeamRow name={match.team_b_name} score={match.score_b} isWinner={match.winner_id !== null && match.winner_id === match.team_b_id} />
            </div>

            {/* When, where and who runs the table */}
            <div className="flex w-28 min-w-0 flex-col justify-center gap-0.5 border-l border-white/10 bg-white/3 px-2 py-1">
                {match.status === 'live' ? <InfoLine><span className="font-semibold uppercase tracking-widest text-red-400">Ao vivo</span></InfoLine> : null}
                <InfoLine muted={!when}>{when ?? 'Sem data'}</InfoLine>
                <InfoLine muted={!venuePath} title={venuePath ?? undefined}>{venuePath ?? 'Sem local'}</InfoLine>
                {match.neutral_team_name ? (
                    <InfoLine title={`Neutra: ${match.neutral_team_name}`}>
                        <span className="shrink-0">Neutra:</span>
                        <TeamLogo name={match.neutral_team_name} className="h-4 w-4" />
                    </InfoLine>
                ) : null}
            </div>
        </>
    )
    const className = 'flex overflow-hidden rounded-xl border border-white/10 bg-black/65 text-left shadow-lg shadow-black/30'

    if (!onClick) return <div className={className}>{content}</div>
    return (
        <button type="button" onClick={onClick} className={`${className} cursor-pointer transition hover:border-red-800/70 focus-visible:border-red-600 focus-visible:outline-none`}>
            {content}
        </button>
    )
}

interface Props {
    matches: BracketMatch[]
    venues: Venue[]
    teams: Team[]
    /** Called with the updated bracket after a match is edited. */
    onChange?: (matches: BracketMatch[]) => void
}

export default function BracketView({ matches, venues, teams, onChange }: Props) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const canEdit = Boolean(getToken()) && onChange !== undefined
    const venuePathById = new Map(venues.map((v) => [v.id, v.path]))

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
                const venuePath = match.venue_id === null ? null : (venuePathById.get(match.venue_id) ?? match.venue_name)
                return <MatchCard key={match.id} match={match} venuePath={venuePath} onClick={canEdit ? () => setEditingId(match.id) : undefined} />
            }),
        })
    }

    const editing = matches.find((m) => m.id === editingId) ?? null

    return (
        <>
            {canEdit ? <p className="mb-3 text-sm text-zinc-500">Clique em uma partida para agendar ou dar o resultado.</p> : null}
            <BracketLayout rounds={rounds} />
            {editing && onChange ? (
                <MatchDialog
                    key={editing.id}
                    match={editing}
                    nextMatch={matches.find((m) => m.id === editing.next_match_id) ?? null}
                    stage={stageLabel(totalRounds - editing.round)}
                    venues={venues}
                    allTeams={teams}
                    onClose={() => setEditingId(null)}
                    onChange={onChange}
                />
            ) : null}
        </>
    )
}
