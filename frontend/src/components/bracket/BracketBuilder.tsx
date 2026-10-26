import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { createBracket } from '../../services/competition'
import { getToken } from '../../services/auth'
import {
    bracketSize,
    byeMatchIndices,
    matchesPerRound,
    MAX_BRACKET_TEAMS,
    MIN_BRACKET_TEAMS,
    stageLabel,
    type BracketMatch,
    type Team,
} from '../../types/competition'
import Select from '../Select'
import BracketLayout, { type BracketRound } from './BracketLayout'
import TeamLogo from './TeamLogo'

function TeamSelect({ value, teams, taken, onChange }: { value: string; teams: Team[]; taken: Set<string>; onChange: (name: string) => void }) {
    const options = teams.map((team) => ({
        value: team.name,
        label: team.name,
        icon: <TeamLogo name={team.name} />,
        disabled: team.name !== value && taken.has(team.name),
    }))

    return (
        <div className="p-1.5">
            <Select value={value} options={options} onChange={onChange} className="border-transparent bg-transparent py-1.5 hover:bg-white/5" />
        </div>
    )
}

function PlaceholderRow() {
    return (
        <div className="flex items-center gap-2 px-3 py-2 text-sm italic text-zinc-500">
            <span className="h-7 w-7 shrink-0 rounded-full border border-dashed border-white/15" />
            A definir
        </div>
    )
}

/** A match card: each row is either the first-round slot index to select, or null for "A definir". */
function BuilderCard({ rows, editable }: { rows: ReactNode[]; editable: boolean }) {
    return (
        <div className={`w-56 overflow-hidden rounded-xl border ${editable ? 'border-red-950/60 bg-black/65' : 'border-white/10 bg-black/40'}`}>
            {rows.map((row, index) => (
                <div key={index} className={index > 0 ? 'border-t border-white/10' : ''}>
                    {row}
                </div>
            ))}
        </div>
    )
}

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para criar chaveamentos.'
    if (text.includes('status: 409')) return 'Esta modalidade já tem um chaveamento.'
    const match = text.match(/"message":"([^"]+)"/)
    return match ? match[1] : 'Não foi possível criar o chaveamento. Tente novamente.'
}

interface Props {
    code: string
    teams: Team[]
    onCreated: (matches: BracketMatch[]) => void
}


export default function BracketBuilder({ code, teams, onCreated }: Props) {
    const [teamCount, setTeamCount] = useState(8)
    // First-round slots, top to bottom. Slot 2k+1 of a bye match is never used.
    const [slots, setSlots] = useState<string[]>(() => Array(8).fill(''))
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isLoggedIn = Boolean(getToken())

    const size = bracketSize(teamCount)
    const byes = size - teamCount
    const roundSizes = matchesPerRound(size)
    const byeMatches = byeMatchIndices(size, byes)

    const isUsedSlot = (slot: number) => !(slot % 2 === 1 && byeMatches.has((slot - 1) / 2))
    const taken = new Set(slots.filter(Boolean))
    const isComplete = slots.every((name, slot) => !isUsedSlot(slot) || name)

    function changeTeamCount(count: number) {
        setTeamCount(count)
        setSlots(Array(bracketSize(count)).fill(''))
        setError(null)
    }

    function changeSlot(slot: number, name: string) {
        setSlots((prev) => prev.map((current, i) => (i === slot ? name : current)))
    }

    async function handleSubmit() {
        setError(null)
        setIsSubmitting(true)
        try {
            onCreated(await createBracket(code, slots.map((name, slot) => (isUsedSlot(slot) ? name : null))))
        } catch (submitError) {
            setError(errorMessage(submitError))
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectFor = (slot: number) => (
        <TeamSelect value={slots[slot]} teams={teams} taken={taken} onChange={(name) => changeSlot(slot, name)} />
    )

    const rounds: BracketRound[] = roundSizes.map((matchCount, roundIndex) => ({
        label: stageLabel(roundSizes.length - 1 - roundIndex),
        cells: Array.from({ length: matchCount }, (_, position) => {
            // First round: byes leave the position empty, other matches get two selects.
            if (roundIndex === 0) {
                if (byeMatches.has(position)) return null
                return <BuilderCard key={position} editable rows={[selectFor(2 * position), selectFor(2 * position + 1)]} />
            }

            // Second round: a side fed by a bye is selected here, in slot 2k of that bye match k.
            if (roundIndex === 1) {
                const feeders = [2 * position, 2 * position + 1]
                const rows = feeders.map((match) => (byeMatches.has(match) ? selectFor(2 * match) : <PlaceholderRow />))
                const editable = feeders.some((match) => byeMatches.has(match))
                return <BuilderCard key={position} editable={editable} rows={rows} />
            }

            return <BuilderCard key={position} editable={false} rows={[<PlaceholderRow />, <PlaceholderRow />]} />
        }),
    }))

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-4">
                <div className="w-44 space-y-1">
                    <span className="block text-sm font-medium text-zinc-200">Quantidade de times</span>
                    <Select
                        value={teamCount}
                        onChange={changeTeamCount}
                        options={Array.from({ length: MAX_BRACKET_TEAMS - MIN_BRACKET_TEAMS + 1 }, (_, i) => {
                            const n = i + MIN_BRACKET_TEAMS
                            return { value: n, label: `${n} times` }
                        })}
                    />
                </div>

                <button
                    type="button"
                    className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!isComplete || !isLoggedIn || isSubmitting}
                    onClick={handleSubmit}
                >
                    {isSubmitting ? 'Criando...' : 'Criar chaveamento'}
                </button>

                <p className="text-sm text-zinc-400">
                    {byes > 0
                        ? `${byes} ${byes === 1 ? 'time entra' : 'times entram'} direto em ${stageLabel(roundSizes.length - 2)}.`
                        : 'Todos os times jogam a primeira fase.'}
                </p>
            </div>

            {!isLoggedIn ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                    <Link to="/login" className="font-medium text-red-300 hover:text-red-200">Faça login</Link> para criar o chaveamento.
                </p>
            ) : null}
            {teams.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">Nenhum time cadastrado ainda.</p>
            ) : null}
            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            <BracketLayout rounds={rounds} />
        </div>
    )
}
