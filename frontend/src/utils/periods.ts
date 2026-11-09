import type { Period } from '../types/sports'

function year(date: string): string {
    return date.slice(0, 4)
}

/** Years of a period, as shown everywhere: "2025", "2023 – 2026" or "2024 – atual". */
export function periodYears({ started_on, ended_on }: Period): string {
    if (ended_on === null)
        return `${year(started_on)} – atual`
    return year(started_on) === year(ended_on) ? year(started_on) : `${year(started_on)} – ${year(ended_on)}`
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

/** Full dates, for tooltips and editors: "01/03/2023 – 15/12/2024" or "01/03/2023 – atual". */
export function periodDates({ started_on, ended_on }: Period): string {
    const format = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`))
    return `${format(started_on)} – ${ended_on ? format(ended_on) : 'atual'}`
}

/** Today as "YYYY-MM-DD" in Brazil, the max value of the date inputs. */
export function todayIso(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/**
 * Joins periods that overlap or follow each other (≤ 1 day apart), so a role held across
 * several saved periods reads as one line in the timeline. Input order does not matter;
 * output is most recent first.
 */
export function mergePeriods<T extends Period>(periods: T[]): T[] {
    const sorted = [...periods].sort((a, b) => a.started_on.localeCompare(b.started_on))
    const merged: T[] = []
    const dayAfter = (date: string) => {
        const next = new Date(`${date}T00:00:00Z`)
        next.setUTCDate(next.getUTCDate() + 1)
        return next.toISOString().slice(0, 10)
    }
    for (const period of sorted) {
        const last = merged.at(-1)
        if (last && (last.ended_on === null || dayAfter(last.ended_on) >= period.started_on)) {
            if (last.ended_on !== null && (period.ended_on === null || period.ended_on > last.ended_on))
                merged[merged.length - 1] = { ...last, ended_on: period.ended_on }
        } else {
            merged.push({ ...period })
        }
    }
    return merged.reverse()
}

export function isCurrent(period: Period): boolean {
    return period.ended_on === null
}
