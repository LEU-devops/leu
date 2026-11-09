import type { ReactNode } from 'react'
import type { OrganizationIdentity } from '../types/organizations'
import { uploadUrl } from '../services/organizations'
import { organizationBackground } from '../utils/gradient'
import OrganizationLogo from './OrganizationLogo'

type HeaderIdentity = Pick<OrganizationIdentity, 'name' | 'description' | 'gradient' | 'logo_url' | 'banner_url' | 'accent_color' | 'instagram' | 'website' | 'contact_email' | 'store_url'>

interface Props {
    organization: HeaderIdentity
    /** Local previews (object URLs, or null for "removed") that override the stored images. */
    logoSrc?: string | null
    bannerSrc?: string | null
    actions?: ReactNode
}

function IconLink({ href, label, children }: { href: string, label: string, children: ReactNode }) {
    return (
        <a
            href={href}
            target={href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer"
            title={label}
            aria-label={label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-black/30 text-zinc-200 transition hover:bg-white/10 hover:text-white"
        >
            {children}
        </a>
    )
}

const ICON = 'h-4 w-4'

export function OrganizationLinks({ organization }: { organization: HeaderIdentity }) {
    const links: ReactNode[] = []
    if (organization.instagram) {
        links.push(
            <IconLink key="instagram" href={`https://instagram.com/${organization.instagram}`} label={`Instagram @${organization.instagram}`}>
                <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
            </IconLink>,
        )
    }
    if (organization.website) {
        links.push(
            <IconLink key="website" href={organization.website} label="Site">
                <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
                </svg>
            </IconLink>,
        )
    }
    if (organization.store_url) {
        links.push(
            <IconLink key="store" href={organization.store_url} label="Loja">
                <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M6 7h12l-1 13H7L6 7z" />
                    <path d="M9 7a3 3 0 0 1 6 0" />
                </svg>
            </IconLink>,
        )
    }
    if (organization.contact_email) {
        links.push(
            <IconLink key="email" href={`mailto:${organization.contact_email}`} label={`E-mail: ${organization.contact_email}`}>
                <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                </svg>
            </IconLink>,
        )
    }
    return links.length > 0 ? <div className="flex flex-wrap gap-2">{links}</div> : null
}

/** Top of an organization's page: banner (or gradient), logo, name, description and links. */
export default function OrganizationHeader({ organization, logoSrc, bannerSrc, actions }: Props) {
    const banner = bannerSrc !== undefined ? bannerSrc : organization.banner_url ? uploadUrl(organization.banner_url) : null

    return (
        <header
            className="overflow-hidden rounded-3xl border border-white/10 bg-black/40"
            style={{
                backgroundImage: organizationBackground(organization.gradient),
                borderColor: organization.accent_color ? `${organization.accent_color}66` : undefined,
            }}
        >
            {banner ? (
                <div
                    className="h-32 bg-cover bg-center md:h-44"
                    style={{ backgroundImage: `linear-gradient(to bottom, transparent 40%, rgb(0 0 0 / 0.45)), url("${banner}")` }}
                />
            ) : null}
            <div className="flex flex-wrap items-center gap-3 p-4">
                <OrganizationLogo organization={organization} src={logoSrc} />
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500" style={{ color: organization.accent_color ?? undefined }}>
                        Entidade
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{organization.name}</h1>
                    <p className="text-sm text-zinc-400">{organization.description || 'Sem descrição cadastrada.'}</p>
                </div>
                <OrganizationLinks organization={organization} />
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
        </header>
    )
}
