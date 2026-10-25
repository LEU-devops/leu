import type { ReactNode } from 'react'

export interface BracketRound {
    label: string
    /** One entry per position; `null` leaves the position empty (a bye). */
    cells: (ReactNode | null)[]
}

function Connector({ top, bottom }: { top: boolean; bottom: boolean }) {
    if (!top && !bottom) return <div className="flex-1" />
    return (
        <div className="flex flex-1 items-center">
            <div className="flex h-1/2 w-5 flex-col">
                <div className={`flex-1 border-white/20 ${top ? 'rounded-tr-lg border-t border-r' : ''}`} />
                <div className={`flex-1 border-white/20 ${bottom ? 'rounded-br-lg border-b border-r' : ''}`} />
            </div>
            <div className="w-5 border-t border-white/20" />
        </div>
    )
}

/**
 * Lays out rounds as columns, with connector lines joining each pair of
 * matches to the match they feed. Every column stretches to the same height
 * and each cell takes an equal share of it, so the connectors line up with
 * the centers of the cells they join.
 */
export default function BracketLayout({ rounds }: { rounds: BracketRound[] }) {
    const firstRoundCells = rounds[0]?.cells.length ?? 1

    return (
        <div className="overflow-x-auto pb-4">
            <div className="flex min-w-max items-stretch" style={{ minHeight: firstRoundCells * 128 }}>
                {rounds.map((round, roundIndex) => (
                    <div key={round.label} className="flex items-stretch">
                        <div className="flex flex-col">
                            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-red-400">{round.label}</p>
                            <div className="flex flex-1 flex-col">
                                {round.cells.map((cell, cellIndex) => (
                                    <div key={cellIndex} className="flex flex-1 items-center">
                                        {cell}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {roundIndex < rounds.length - 1 ? (
                            <div className="flex flex-col pt-7">
                                {Array.from({ length: round.cells.length / 2 }, (_, pair) => (
                                    <Connector key={pair} top={round.cells[2 * pair] !== null} bottom={round.cells[2 * pair + 1] !== null} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    )
}
