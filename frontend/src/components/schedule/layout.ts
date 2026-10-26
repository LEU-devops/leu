import type { ScheduledMatch, Venue } from '../../types/competition'

/** How long a match occupies in the table. */
export const SLOT_MINUTES = 90
/** Granularity of the grid: a match starting off the 1h30 mesh still lands on the right row. */
export const STEP_MINUTES = 15
export const ROWS_PER_SLOT = SLOT_MINUTES / STEP_MINUTES
/** Height of one STEP_MINUTES row, so a slot is 9rem tall. */
export const ROW_HEIGHT_REM = 1.5

const MINUTE = 60_000

/** A table column: a venue without children, with its lineage from the root down to itself. */
export interface Column {
    venue: Venue
    lineage: Venue[]
}

/** A header cell: `venue` spanning `colSpan` columns at nesting `level`, and `rowSpan` levels down. */
export interface HeaderCell {
    venue: Venue
    level: number
    colStart: number
    colSpan: number
    rowSpan: number
}

export interface PlacedMatch {
    match: ScheduledMatch
    /** 0-based STEP_MINUTES row from the day start. */
    row: number
    /** 0-based column index range, inclusive. */
    colStart: number
    colEnd: number
}

/** Matches stacked in the same cell (same venue, same start): a scheduling conflict kept visible. */
export interface Cell {
    key: string
    row: number
    colStart: number
    colEnd: number
    matches: ScheduledMatch[]
}

export interface Day {
    key: string
    date: Date
    start: Date
    /** Number of STEP_MINUTES rows the day spans. */
    rows: number
    cells: Cell[]
}

/** A match belongs to the table only when it has both a time and a venue. */
export function isPlaceable(match: ScheduledMatch): boolean {
    return match.scheduled_at !== null && match.venue_id !== null && !Number.isNaN(new Date(match.scheduled_at).getTime())
}

/**
 * Columns are the leaf venues whose lineage contains some match venue, ordered by path so that
 * sibling courts stay side by side. A match scheduled in a parent venue covers every leaf below it.
 */
export function buildColumns(venues: Venue[], matches: ScheduledMatch[]): Column[] {
    const byId = new Map(venues.map((v) => [v.id, v]))
    const parents = new Set(venues.flatMap((v) => (v.parent_id === null ? [] : [v.parent_id])))
    const used = new Set(matches.filter(isPlaceable).map((m) => m.venue_id as number))

    function lineageOf(venue: Venue): Venue[] {
        const out: Venue[] = []
        for (let cur: Venue | undefined = venue; cur; cur = cur.parent_id === null ? undefined : byId.get(cur.parent_id))
            out.unshift(cur)
        return out
    }

    return venues
        .filter((v) => !parents.has(v.id))
        .map((venue) => ({ venue, lineage: lineageOf(venue) }))
        .filter((c) => c.lineage.some((a) => used.has(a.id)))
        .sort((a, b) => a.venue.path.localeCompare(b.venue.path))
}

/** Header cells per nesting level; consecutive columns under the same venue are merged. */
export function buildHeader(columns: Column[]): { depth: number; cells: HeaderCell[] } {
    const depth = Math.max(1, ...columns.map((c) => c.lineage.length))
    const cells: HeaderCell[] = []

    for (let level = 0; level < depth; level++) {
        let open: HeaderCell | null = null
        columns.forEach((column, index) => {
            const venue = column.lineage[level]
            if (!venue) {
                open = null
                return
            }
            if (open && open.venue.id === venue.id) {
                open.colSpan++
                return
            }
            const isLeaf = level === column.lineage.length - 1
            open = { venue, level, colStart: index, colSpan: 1, rowSpan: isLeaf ? depth - level : 1 }
            cells.push(open)
        })
    }

    return { depth, cells }
}

function localDayKey(date: Date): string {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
}

/** Groups placeable matches by local day and lays each day out on a STEP_MINUTES grid. */
export function buildDays(matches: ScheduledMatch[], columns: Column[]): Day[] {
    const columnRange = new Map<number, [number, number]>()
    columns.forEach((column, index) => {
        for (const venue of column.lineage) {
            const range = columnRange.get(venue.id)
            if (range) range[1] = index
            else columnRange.set(venue.id, [index, index])
        }
    })

    const byDay = new Map<string, { date: Date; placed: { match: ScheduledMatch; at: Date; range: [number, number] }[] }>()
    for (const match of matches) {
        if (!isPlaceable(match)) continue
        const range = columnRange.get(match.venue_id as number)
        if (!range) continue
        const at = new Date(match.scheduled_at as string)
        const key = localDayKey(at)
        const day = byDay.get(key) ?? { date: at, placed: [] }
        day.placed.push({ match, at, range })
        byDay.set(key, day)
    }

    return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, { date, placed }]) => {
            const startMs = Math.min(...placed.map((p) => p.at.getTime()))
            const endMs = Math.max(...placed.map((p) => p.at.getTime())) + SLOT_MINUTES * MINUTE
            const start = new Date(startMs)
            const rows = Math.ceil((endMs - startMs) / (STEP_MINUTES * MINUTE))

            const cells = new Map<string, Cell>()
            for (const { match, at, range } of placed) {
                const row = Math.round((at.getTime() - startMs) / (STEP_MINUTES * MINUTE))
                const cellKey = `${match.venue_id}:${row}`
                const cell = cells.get(cellKey) ?? { key: cellKey, row, colStart: range[0], colEnd: range[1], matches: [] }
                cell.matches.push(match)
                cells.set(cellKey, cell)
            }

            return { key, date, start, rows, cells: [...cells.values()] }
        })
}

/** Start times of the 1h30 slots of a day, with the row each one begins at. */
export function slotsOf(day: Day): { time: Date; row: number; rows: number }[] {
    const slots: { time: Date; row: number; rows: number }[] = []
    for (let row = 0; row < day.rows; row += ROWS_PER_SLOT)
        slots.push({ time: new Date(day.start.getTime() + row * STEP_MINUTES * MINUTE), row, rows: Math.min(ROWS_PER_SLOT, day.rows - row) })
    return slots
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

export function formatTime(date: Date): string {
    return timeFormat.format(date)
}

export function formatDay(date: Date): string {
    const text = dayFormat.format(date)
    return text.charAt(0).toUpperCase() + text.slice(1)
}
