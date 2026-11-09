export interface GradientParts {
    angle: number
    from: string
    to: string
}

export const DEFAULT_GRADIENT: GradientParts = { angle: 135, from: '#1f2937', to: '#111827' }

const PATTERN = /^linear-gradient\((\d{1,3})deg, (#[0-9a-f]{6}) \d{1,3}%, (#[0-9a-f]{6}) \d{1,3}%\)$/i

/** Splits a stored gradient into the editor's controls (falls back to the default). */
export function parseGradient(gradient: string): GradientParts {
    const match = gradient.trim().match(PATTERN)
    if (!match)
        return DEFAULT_GRADIENT
    return { angle: Number(match[1]), from: match[2].toLowerCase(), to: match[3].toLowerCase() }
}

/** The only gradient shape the backend accepts. */
export function buildGradient({ angle, from, to }: GradientParts): string {
    return `linear-gradient(${Math.round(angle)}deg, ${from} 0%, ${to} 100%)`
}

/** Background of an organization card/header: its gradient plus the soft highlight used across the app. */
export function organizationBackground(gradient: string): string {
    return `${gradient}, radial-gradient(circle at top right, rgb(255 255 255 / 0.08), transparent 55%)`
}
