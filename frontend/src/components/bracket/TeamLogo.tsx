import { useState } from 'react'

/** Candidate files under public/logos for a team name: exact name, then uppercase without spaces. */
function logoCandidates(name: string): string[] {
    const normalized = name.toUpperCase().replace(/\s+/g, '')
    const names = normalized === name ? [name] : [name, normalized]
    return names.map((n) => `/logos/${encodeURIComponent(n)}.png`)
}

interface Props {
    name: string
    className?: string
}

/** Shows the team logo from public/logos, or the team initials when there is none. */
export default function TeamLogo(props: Props) {
    // Keyed by name so the candidate index restarts whenever the team changes.
    return <LogoImage key={props.name} {...props} />
}

function LogoImage({ name, className = 'h-7 w-7' }: Props) {
    const [index, setIndex] = useState(0)

    const candidates = logoCandidates(name)
    const src = candidates[index]

    if (!src) {
        return (
            <span className={`${className} inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-zinc-300`}>
                {name.slice(0, 2).toUpperCase()}
            </span>
        )
    }

    return (
        <img
            src={src}
            alt=""
            className={`${className} shrink-0 rounded-full object-contain`}
            onError={() => setIndex((i) => i + 1)}
        />
    )
}
