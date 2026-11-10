import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import Loading from '../components/Loading'
import OrganizationHeader from '../components/OrganizationHeader'
import OrganizationLogo from '../components/OrganizationLogo'
import { getOrganization } from '../services/competition'
import { deleteOrganizationImage, getOrganizationPermissions, updateOrganizationIdentity, uploadOrganizationImage, uploadUrl } from '../services/organizations'
import type { IdentityChange, OrganizationHierarchy } from '../types/organizations'
import { buildGradient, organizationBackground, parseGradient, type GradientParts } from '../utils/gradient'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 disabled:opacity-50'
const SECONDARY_BUTTON = 'rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-40'
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const GRADIENT_PRESETS: GradientParts[] = [
    { angle: 135, from: '#7f1d1d', to: '#111827' },
    { angle: 135, from: '#14532d', to: '#052e16' },
    { angle: 135, from: '#1e3a8a', to: '#172554' },
    { angle: 135, from: '#0f766e', to: '#134e4a' },
    { angle: 135, from: '#854d0e', to: '#422006' },
    { angle: 135, from: '#9f1239', to: '#4c0519' },
    { angle: 135, from: '#6b21a8', to: '#1e1b4b' },
    { angle: 135, from: '#334155', to: '#0f172a' },
]

/** Text fields as edited in the form (strings, never null). */
interface Draft {
    name: string
    short_name: string
    description: string
    about: string
    gradient: GradientParts
    useAccent: boolean
    accent: string
    instagram: string
    website: string
    contact_email: string
    store_url: string
}

/** Pending image change: a new file (with its preview URL) or a removal. */
type ImageChange = { file: File, preview: string } | 'remove' | null

function draftFrom(organization: OrganizationHierarchy): Draft {
    return {
        name: organization.name,
        short_name: organization.short_name ?? '',
        description: organization.description ?? '',
        about: organization.about ?? '',
        gradient: parseGradient(organization.gradient),
        useAccent: organization.accent_color !== null,
        accent: organization.accent_color ?? '#ef4444',
        instagram: organization.instagram ? `@${organization.instagram}` : '',
        website: organization.website ?? '',
        contact_email: organization.contact_email ?? '',
        store_url: organization.store_url ?? '',
    }
}

function nullable(text: string): string | null {
    const trimmed = text.trim()
    return trimmed.length > 0 ? trimmed : null
}

/** Only the fields that differ from the saved organization. */
function diff(organization: OrganizationHierarchy, draft: Draft): IdentityChange {
    const original = draftFrom(organization)
    const change: IdentityChange = {}
    if (draft.name.trim() !== original.name) change.name = draft.name.trim()
    if (draft.short_name.trim().toUpperCase() !== original.short_name) change.short_name = nullable(draft.short_name)?.toUpperCase() ?? null
    if (draft.description.trim() !== original.description) change.description = nullable(draft.description)
    if (draft.about.trim() !== original.about) change.about = nullable(draft.about)
    const gradient = buildGradient(draft.gradient)
    if (gradient !== buildGradient(original.gradient)) change.gradient = gradient
    const accent = draft.useAccent ? draft.accent.toLowerCase() : null
    if (accent !== organization.accent_color) change.accent_color = accent
    if (draft.instagram.trim() !== original.instagram) change.instagram = nullable(draft.instagram)
    if (draft.website.trim() !== original.website) change.website = nullable(draft.website)
    if (draft.contact_email.trim() !== original.contact_email) change.contact_email = nullable(draft.contact_email)
    if (draft.store_url.trim() !== original.store_url) change.store_url = nullable(draft.store_url)
    return change
}

const ERROR_TRANSLATIONS: [RegExp, string][] = [
    [/name is required/, 'O nome é obrigatório.'],
    [/LEU name cannot be changed/, 'O nome da LEU não pode ser alterado.'],
    [/already uses this name/, 'Já existe outra entidade com esse nome.'],
    [/name must have at most/, 'O nome pode ter no máximo 30 caracteres.'],
    [/description must have at most/, 'O nome completo pode ter no máximo 200 caracteres.'],
    [/about must have at most/, 'O texto "Sobre" pode ter no máximo 2000 caracteres.'],
    [/instagram must be/, 'Instagram inválido. Use @usuario ou o link do perfil.'],
    [/website must be/, 'Link do site inválido.'],
    [/store_url must be/, 'Link da loja inválido.'],
    [/contact_email must be/, 'E-mail de contato inválido.'],
    [/Unsupported image type/, 'Formato de imagem não suportado (use PNG, JPG ou WebP).'],
]

function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403'))
        return 'Você não tem permissão para editar a identidade visual desta entidade.'
    if (text.includes('status: 413'))
        return 'Imagem muito grande (máximo 5 MB).'
    const message = text.match(/"message":"([^"]+)"/)?.[1] ?? ''
    return ERROR_TRANSLATIONS.find(([pattern]) => pattern.test(message))?.[1] ?? 'Não foi possível salvar. Tente novamente.'
}

function Field({ label, hint, children }: { label: string, hint?: string, children: ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="text-xs text-zinc-400">{label}</span>
            {children}
            {hint ? <span className="block text-[11px] text-zinc-500">{hint}</span> : null}
        </label>
    )
}

function Card({ title, children }: { title: string, children: ReactNode }) {
    return (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">{title}</h2>
            {children}
        </section>
    )
}

function ColorInput({ value, onChange, label }: { value: string, onChange: (value: string) => void, label: string }) {
    return (
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
            <input
                type="color"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-label={label}
                className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="font-mono text-xs text-zinc-300">{value}</span>
        </label>
    )
}

function ImagePicker({ label, hint, preview, hasImage, canRemove, change, onPick, onRemove, onReset, onError }: {
    label: string
    hint: string
    /** How the image looks now (saved or pending). */
    preview: ReactNode
    hasImage: boolean
    /** Only an uploaded image (or a pending file) can be removed. */
    canRemove: boolean
    change: ImageChange
    onPick: (file: File) => void
    onRemove: () => void
    onReset: () => void
    onError: (message: string) => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)

    function onFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file)
            return
        if (!IMAGE_TYPES.includes(file.type))
            return onError('Formato de imagem não suportado (use PNG, JPG ou WebP).')
        if (file.size > MAX_IMAGE_BYTES)
            return onError('Imagem muito grande (máximo 5 MB).')
        onPick(file)
    }

    return (
        <div className="space-y-2">
            <span className="text-xs text-zinc-400">{label}</span>
            <div className="flex flex-wrap items-center gap-3">
                {preview}
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => inputRef.current?.click()} className={SECONDARY_BUTTON}>
                        {hasImage ? 'Trocar' : 'Enviar'}
                    </button>
                    {canRemove ? <button type="button" onClick={onRemove} className={SECONDARY_BUTTON}>Remover</button> : null}
                    {change !== null ? <button type="button" onClick={onReset} className={SECONDARY_BUTTON}>Desfazer</button> : null}
                </div>
                <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(',')} onChange={onFile} className="hidden" />
            </div>
            <span className="block text-[11px] text-zinc-500">{hint}</span>
        </div>
    )
}

export default function OrganizationIdentityPage() {
    const params = useParams()
    const id = Number(params.id)
    const invalidId = !Number.isInteger(id) || id <= 0

    const [organization, setOrganization] = useState<OrganizationHierarchy | null>(null)
    const [draft, setDraft] = useState<Draft | null>(null)
    const [canManage, setCanManage] = useState(false)
    const [loading, setLoading] = useState(!invalidId)
    const [loadError, setLoadError] = useState<string | null>(null)
    const error = invalidId ? 'Entidade inválida.' : loadError

    const [logoChange, setLogoChange] = useState<ImageChange>(null)
    const [bannerChange, setBannerChange] = useState<ImageChange>(null)

    const [saving, setSaving] = useState(false)
    const [status, setStatus] = useState<{ kind: 'error' | 'success', text: string } | null>(null)

    useEffect(() => {
        if (invalidId)
            return
        let cancelled = false
        Promise.all([getOrganization(id), getOrganizationPermissions(id)])
            .then(([data, permissions]) => {
                if (cancelled)
                    return
                setOrganization(data)
                setDraft(draftFrom(data))
                setCanManage(permissions.canManageIdentity)
            })
            .catch(() => {
                if (!cancelled)
                    setLoadError('Não foi possível carregar a entidade.')
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [id, invalidId])

    // Free the local previews when they are replaced or the page closes.
    useEffect(() => () => {
        if (logoChange && logoChange !== 'remove') URL.revokeObjectURL(logoChange.preview)
    }, [logoChange])
    useEffect(() => () => {
        if (bannerChange && bannerChange !== 'remove') URL.revokeObjectURL(bannerChange.preview)
    }, [bannerChange])

    const textChange = useMemo(() => (organization && draft ? diff(organization, draft) : {}), [organization, draft])
    const changeCount = Object.keys(textChange).length + (logoChange ? 1 : 0) + (bannerChange ? 1 : 0)
    const hasChanges = changeCount > 0

    useEffect(() => {
        if (!hasChanges)
            return
        function onBeforeUnload(event: BeforeUnloadEvent) {
            event.preventDefault()
        }
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => window.removeEventListener('beforeunload', onBeforeUnload)
    }, [hasChanges])

    function update<K extends keyof Draft>(key: K, value: Draft[K]) {
        setStatus(null)
        setDraft((previous) => (previous ? { ...previous, [key]: value } : previous))
    }

    function imageSrc(change: ImageChange, saved: string | null): string | null {
        if (change === 'remove') return null
        if (change) return change.preview
        return saved ? uploadUrl(saved) : null
    }

    /** undefined keeps OrganizationLogo's own fallback chain (uploaded → bundled → initials). */
    const logoSrc = logoChange === null ? undefined : imageSrc(logoChange, null)
    const bannerSrc = organization ? imageSrc(bannerChange, organization.banner_url) : null

    const preview = organization && draft
        ? {
            ...organization,
            name: draft.name.trim() || organization.name,
            short_name: nullable(draft.short_name)?.toUpperCase() ?? null,
            description: nullable(draft.description),
            gradient: buildGradient(draft.gradient),
            accent_color: draft.useAccent ? draft.accent : null,
            instagram: nullable(draft.instagram.replace(/^@/, '')),
            website: nullable(draft.website),
            contact_email: nullable(draft.contact_email),
            store_url: nullable(draft.store_url),
        }
        : null

    function discard() {
        if (!organization)
            return
        setDraft(draftFrom(organization))
        setLogoChange(null)
        setBannerChange(null)
        setStatus(null)
    }

    async function save() {
        if (!organization || !hasChanges)
            return
        setSaving(true)
        setStatus(null)
        let latest = organization
        try {
            if (Object.keys(textChange).length > 0)
                latest = await updateOrganizationIdentity(organization.id, textChange)
            for (const [kind, change] of [['logo', logoChange], ['banner', bannerChange]] as const) {
                if (change === 'remove')
                    latest = await deleteOrganizationImage(organization.id, kind)
                else if (change)
                    latest = await uploadOrganizationImage(organization.id, kind, change.file)
                if (kind === 'logo') setLogoChange(null)
                else setBannerChange(null)
            }
            setOrganization(latest)
            setDraft(draftFrom(latest))
            setStatus({ kind: 'success', text: 'Identidade visual salva.' })
        } catch (err) {
            // Keep whatever was already saved, so the remaining draft shows only what failed.
            setOrganization(latest)
            setStatus({ kind: 'error', text: errorMessage(err) })
        } finally {
            setSaving(false)
        }
    }

    const isLeu = organization?.name === 'LEU'

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <Link to={`/entidades/${id}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                <span aria-hidden>←</span>
                Voltar para a entidade
            </Link>

            {loading ? <Loading /> : null}
            {error ? <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {!loading && !error && organization && !canManage ? (
                <p className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                    Apenas presidentes e diretores de Marketing da {organization.name} (ou da LEU) podem editar a identidade visual.
                </p>
            ) : null}

            {!loading && !error && organization && draft && preview && canManage ? (
                <div className="mx-auto max-w-6xl space-y-6 pb-28">
                    <header>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">{organization.name}</p>
                        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Identidade visual</h1>
                        <p className="text-sm text-zinc-400">As alterações aparecem na pré-visualização e só são publicadas ao clicar em “Salvar alterações”.</p>
                    </header>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="space-y-6">
                            <Card title="Nome">
                                <Field label="Nome (sigla)" hint={isLeu ? 'O nome da LEU não pode ser alterado.' : 'Usado nos menus e cards. Até 30 caracteres.'}>
                                    <input value={draft.name} onChange={(event) => update('name', event.target.value)} maxLength={30} disabled={isLeu} className={INPUT_CLASS} />
                                </Field>
                                <Field label="Nome nas Copas" hint="Como o time aparece por padrão em chaveamentos e pontuação (ex.: FEA). Cada edição pode usar outro.">
                                    <input
                                        value={draft.short_name}
                                        onChange={(event) => update('short_name', event.target.value.toUpperCase())}
                                        maxLength={12}
                                        placeholder={draft.name.replace(/^AAA/, '') || 'FEA'}
                                        className={`${INPUT_CLASS} uppercase`}
                                    />
                                </Field>
                                <Field label="Nome completo">
                                    <input
                                        value={draft.description}
                                        onChange={(event) => update('description', event.target.value)}
                                        maxLength={200}
                                        placeholder="Associação Atlética Acadêmica..."
                                        className={INPUT_CLASS}
                                    />
                                </Field>
                            </Card>

                            <Card title="Imagens">
                                <ImagePicker
                                    label="Logo"
                                    hint="PNG com fundo transparente, quadrado, até 5 MB. Sem logo enviada, usa a padrão do app (se houver) ou as iniciais."
                                    preview={<OrganizationLogo organization={preview} src={logoSrc} className="h-20 w-20" />}
                                    hasImage={logoChange !== 'remove' && (logoChange !== null || organization.logo_url !== null)}
                                    canRemove={logoChange !== 'remove' && (logoChange !== null || organization.logo_url !== null)}
                                    change={logoChange}
                                    onPick={(file) => {
                                        setStatus(null)
                                        setLogoChange({ file, preview: URL.createObjectURL(file) })
                                    }}
                                    onRemove={() => setLogoChange('remove')}
                                    onReset={() => setLogoChange(null)}
                                    onError={(text) => setStatus({ kind: 'error', text })}
                                />
                                <ImagePicker
                                    label="Banner / capa"
                                    hint="Imagem larga (ex.: 1600×400), até 5 MB. Aparece no topo da página da entidade."
                                    preview={(
                                        <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                                            {bannerSrc
                                                ? <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
                                                : <span className="text-[11px] text-zinc-600">Sem banner</span>}
                                        </div>
                                    )}
                                    hasImage={bannerSrc !== null}
                                    canRemove={bannerSrc !== null}
                                    change={bannerChange}
                                    onPick={(file) => {
                                        setStatus(null)
                                        setBannerChange({ file, preview: URL.createObjectURL(file) })
                                    }}
                                    onRemove={() => setBannerChange('remove')}
                                    onReset={() => setBannerChange(null)}
                                    onError={(text) => setStatus({ kind: 'error', text })}
                                />
                            </Card>

                            <Card title="Cores">
                                <div className="space-y-2">
                                    <span className="text-xs text-zinc-400">Gradiente padrão</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <ColorInput label="Cor inicial" value={draft.gradient.from} onChange={(from) => update('gradient', { ...draft.gradient, from })} />
                                        <span className="text-zinc-500">→</span>
                                        <ColorInput label="Cor final" value={draft.gradient.to} onChange={(to) => update('gradient', { ...draft.gradient, to })} />
                                    </div>
                                    <label className="flex items-center gap-3 text-xs text-zinc-400">
                                        Ângulo
                                        <input
                                            type="range"
                                            min={0}
                                            max={360}
                                            step={5}
                                            value={draft.gradient.angle}
                                            onChange={(event) => update('gradient', { ...draft.gradient, angle: Number(event.target.value) })}
                                            className="flex-1 accent-red-600"
                                        />
                                        <span className="w-10 text-right tabular-nums text-zinc-300">{draft.gradient.angle}°</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {GRADIENT_PRESETS.map((preset) => (
                                            <button
                                                key={`${preset.from}${preset.to}`}
                                                type="button"
                                                title="Usar este gradiente"
                                                onClick={() => update('gradient', preset)}
                                                className="h-8 w-8 rounded-lg border border-white/15 transition hover:scale-110"
                                                style={{ backgroundImage: buildGradient(preset) }}
                                            />
                                        ))}
                                    </div>
                                    <span className="block text-[11px] text-zinc-500">Fundo dos cards e do topo da página da entidade.</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                                        <input type="checkbox" checked={draft.useAccent} onChange={(event) => update('useAccent', event.target.checked)} className="accent-red-600" />
                                        Usar cor de destaque
                                    </label>
                                    {draft.useAccent ? <ColorInput label="Cor de destaque" value={draft.accent} onChange={(accent) => update('accent', accent)} /> : null}
                                    <span className="block text-[11px] text-zinc-500">Usada nos títulos das seções e na borda do topo da página da entidade.</span>
                                </div>
                            </Card>

                            <Card title="Sobre">
                                <Field label="Texto “Sobre”" hint={`${draft.about.length}/2000 — história, missão, o que a entidade faz.`}>
                                    <textarea
                                        value={draft.about}
                                        onChange={(event) => update('about', event.target.value)}
                                        maxLength={2000}
                                        rows={6}
                                        className={`${INPUT_CLASS} resize-y`}
                                    />
                                </Field>
                            </Card>

                            <Card title="Redes e contato">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Instagram">
                                        <input value={draft.instagram} onChange={(event) => update('instagram', event.target.value)} placeholder="@usuario" className={INPUT_CLASS} />
                                    </Field>
                                    <Field label="E-mail de contato">
                                        <input type="email" value={draft.contact_email} onChange={(event) => update('contact_email', event.target.value)} placeholder="contato@..." className={INPUT_CLASS} />
                                    </Field>
                                    <Field label="Site">
                                        <input value={draft.website} onChange={(event) => update('website', event.target.value)} placeholder="https://..." className={INPUT_CLASS} />
                                    </Field>
                                    <Field label="Loja">
                                        <input value={draft.store_url} onChange={(event) => update('store_url', event.target.value)} placeholder="https://..." className={INPUT_CLASS} />
                                    </Field>
                                </div>
                            </Card>
                        </div>

                        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Pré-visualização</p>
                            <OrganizationHeader organization={preview} logoSrc={logoSrc} bannerSrc={bannerSrc} />
                            {preview.accent_color ? (
                                <div className="flex items-center gap-4 px-1">
                                    <span className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: preview.accent_color }}>Presidência</span>
                                    <span className="h-px flex-1" style={{ backgroundImage: `linear-gradient(to right, ${preview.accent_color}80, transparent)` }} />
                                </div>
                            ) : null}
                            <div
                                className="max-w-sm rounded-3xl border border-white/10 bg-black/40 p-5"
                                style={{ backgroundImage: organizationBackground(preview.gradient) }}
                            >
                                <div className="flex items-center gap-3">
                                    <OrganizationLogo organization={preview} src={logoSrc} className="h-12 w-12" />
                                    <div className="min-w-0">
                                        <p className="truncate text-lg font-semibold text-zinc-100">{preview.name}</p>
                                        <p className="truncate text-xs text-zinc-500">{preview.description || 'Sem descrição cadastrada.'}</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-[11px] text-zinc-500">Card na lista de entidades</p>
                            </div>
                        </aside>
                    </div>
                </div>
            ) : null}

            {canManage && organization ? (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 backdrop-blur">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm text-zinc-400">
                            {status ? <span className={status.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}>{status.text}</span>
                                : hasChanges ? `${changeCount} ${changeCount === 1 ? 'alteração pendente' : 'alterações pendentes'}`
                                    : 'Nenhuma alteração pendente'}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={discard}
                                disabled={!hasChanges || saving}
                                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-40"
                            >
                                Descartar
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                disabled={!hasChanges || saving}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {saving ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    )
}
