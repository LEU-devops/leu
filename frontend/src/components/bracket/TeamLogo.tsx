interface Props {
    name: string
    className?: string
}

/** Shows the team logo from public/logos, or the team initials when there is none. */
export default function TeamLogo(props: Props) {
    // Keyed by name so the candidate index restarts whenever the team changes.
    return <LogoImage key={props.name} {...props} />
}

const LOGOS_MAP: Record<string, string> = {
    AAAECA: 'AAAAECA',
    AAAETA: 'AAAAETA',
    AAAFEA: 'AAAAFEA',
    AAAFEAGRI: 'AAAAFEAGRI',
    AAAFEE: 'AAAAFEE',
    AAAFEQ: 'AAAAFEQ',
    AAAMEC: 'AAAMEC',
    AAAKI: 'AAAAKI',
    AAAXD: 'AAAXD',
    ECA: 'AAAECA',
    ETA: 'AAAETA',
    FEA: 'AAAFEA',
    FEAGRI: 'AAAFEAGRI',
    FEE: 'AAAFEE',
    FEEC: 'AAAFEE',
    FEQ: 'AAAFEQ',
    EQ: 'AAAFEQ',
    MEC: 'AAAMEC',
    AKI: 'AAAKI',
    XD: 'AAAXD',
}

function LogoImage({ name, className = 'h-7 w-7' }: Props) {
    const imageName = LOGOS_MAP[name]
    const src = imageName && `/logos/${imageName}.png`

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
        />
    )
}
