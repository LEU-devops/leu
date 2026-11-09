import { PLACEMENT_COLORS } from '../../utils/awards'

interface IconProps {
    color?: string
    className?: string
}

/** Individual award. */
export function MedalIcon({ color = PLACEMENT_COLORS.none, className = 'h-7 w-7' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 2h4l2 6H9L7 2z" fill="#dc2626" />
            <path d="M17 2h-4l-2 6h4l2-6z" fill="#991b1b" />
            <circle cx="12" cy="15" r="6.5" fill={color} />
            <circle cx="12" cy="15" r="4.5" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.2" />
            <path d="M12 12.3l.85 1.75 1.9.27-1.38 1.33.33 1.9L12 16.65l-1.7.9.33-1.9-1.38-1.33 1.9-.27z" fill="rgb(0 0 0 / 0.3)" />
        </svg>
    )
}

/** Team award. */
export function TrophyIcon({ color = PLACEMENT_COLORS.none, className = 'h-7 w-7' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 4H4v2a4 4 0 0 0 4 4M17 4h3v2a4 4 0 0 1-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 3h10v6a5 5 0 0 1-10 0V3z" fill={color} />
            <path d="M10.5 14h3v3h-3z" fill={color} />
            <path d="M8 21h8l-1-4H9l-1 4z" fill={color} />
            <path d="M9.5 5.5v3" stroke="rgb(255 255 255 / 0.45)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    )
}

/** Athlete of a team. */
export function JerseyIcon({ color = '#f4f4f5', className = 'h-7 w-7' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8.5 3L4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 15.5 3c-.5 1.5-1.9 2.5-3.5 2.5S9 4.5 8.5 3z"
                fill={color}
                fillOpacity="0.9"
            />
            <path d="M9.5 11h5M12 11v6" stroke="rgb(0 0 0 / 0.35)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    )
}

/** DM (diretor de modalidade). */
export function WhistleIcon({ color = '#f4f4f5', className = 'h-7 w-7' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 4l5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="9.5" cy="15" r="5.5" fill={color} />
            <path d="M12 10h8.5v4H14" fill={color} />
            <path d="M12 10h8.5v4H14.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            <circle cx="9.5" cy="15" r="2" fill="rgb(0 0 0 / 0.35)" />
        </svg>
    )
}

/** Diretoria interna da LEU (presidents and vices of the AAAs). */
export function ColumnsIcon({ color = '#f4f4f5', className = 'h-7 w-7' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 9l9-5 9 5H3z" fill={color} />
            <path d="M5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M3 20h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}

/** Generic achievement (multiatleta, multicampeão). */
export function StarIcon({ color = '#f4f4f5', className = 'h-7 w-7' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z" fill={color} />
        </svg>
    )
}
