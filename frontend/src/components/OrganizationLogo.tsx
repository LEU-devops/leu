import { useState } from 'react'
import { uploadUrl } from '../services/organizations'
import type { OrganizationIdentity } from '../types/organizations'

interface Props {
    organization: Pick<OrganizationIdentity, 'name' | 'logo_url'>
    /** Overrides the stored logo, e.g. with a local preview (object URL) before upload. */
    src?: string | null
    className?: string
}

/**
 * Uploaded logo when there is one, else the bundled `public/logos/{name}.png`,
 * else the first letters of the name.
 */
export default function OrganizationLogo({ organization, src, className = 'h-14 w-14' }: Props) {
    const candidate = src !== undefined
        ? src
        : organization.logo_url ? uploadUrl(organization.logo_url) : `/logos/${organization.name}.png`
    const [failedSrc, setFailedSrc] = useState<string | null>(null)

    if (!candidate || failedSrc === candidate) {
        return (
            <span className={`${className} inline-flex shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-xs font-semibold text-zinc-300`}>
                {organization.name.slice(0, 3).toUpperCase()}
            </span>
        )
    }

    return (
        <img
            src={candidate}
            alt={`Logo ${organization.name}`}
            className={`${className} shrink-0 rounded-2xl border border-white/10 bg-black/20 object-contain p-1`}
            onError={() => setFailedSrc(candidate)}
        />
    )
}
