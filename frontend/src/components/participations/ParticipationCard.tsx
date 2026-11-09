import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../ConfirmDialog'
import { UserAvatar } from '../UserSearch'
import { MedalIcon, TrophyIcon } from '../badges/BadgeIcons'
import { AthletesPicker, ExternalDetailsFields } from './ParticipationFields'
import { detailsPayload, isValidDetails, type ExternalDetails } from '../../utils/participations'
import {
    addParticipationAward,
    deleteParticipation,
    deleteParticipationAward,
    setCopaAthletes,
    sportsErrorMessage,
    updateParticipation,
} from '../../services/sports'
import type { Athlete, Award, Participation } from '../../types/sports'
import { participationResult, placementColor } from '../../utils/awards'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'
const SMALL_BUTTON = 'rounded-lg px-3 py-1 text-xs font-medium transition disabled:opacity-40'
const AWARD_SUGGESTIONS = ['MVP da Partida', 'MVP da Final', 'Destaque do Campeonato', 'Revelação do Campeonato', 'Artilheiro(a)', 'Melhor Goleiro(a)', 'Seleção do Campeonato']

interface Props {
    participation: Participation
    canEdit: boolean
    /** People offered as athletes before searching (e.g. the team's roster). */
    suggestions: Athlete[]
    onChange: (participation: Participation) => void
    /** Called after an externo participation is deleted (or a Copa one is cleared). */
    onDeleted?: () => void
}

function title(participation: Participation): string {
    return `${participation.competition} ${participation.year}`
}

/** What the participation is about: the modality (Copa) or the team, with its organization. */
function subtitle(participation: Participation): string {
    if (participation.kind === 'copa')
        return [participation.modality?.name, participation.organization.name].filter(Boolean).join(' · ')
    return [participation.team?.name, participation.organization.name].filter(Boolean).join(' · ')
}

/** A championship played: result, athletes and the individual awards given there; editable by its managers. */
export default function ParticipationCard({ participation, canEdit, suggestions, onChange, onDeleted }: Props) {
    const [mode, setMode] = useState<'view' | 'edit' | 'award'>('view')
    const [details, setDetails] = useState<ExternalDetails>({ competition: '', year: '', placement: '' })
    const [athletes, setAthletes] = useState<Athlete[]>([])
    const [awardTitle, setAwardTitle] = useState('')
    const [awardees, setAwardees] = useState<string[]>([])
    const [confirm, setConfirm] = useState<{ kind: 'delete' } | { kind: 'award', award: Award } | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const color = placementColor(participation.placement)
    const isCopa = participation.kind === 'copa'
    const podium = participation.placement !== null && participation.placement <= 3

    function startEdit() {
        setDetails({
            competition: participation.competition,
            year: String(participation.year),
            placement: participation.placement === null ? '' : String(participation.placement),
        })
        setAthletes(participation.athletes)
        setError(null)
        setMode('edit')
    }

    async function run(action: () => Promise<Participation | null>) {
        setBusy(true)
        setError(null)
        try {
            const updated = await action()
            if (updated) onChange(updated)
            setMode('view')
            return true
        } catch (err) {
            setError(sportsErrorMessage(err))
            return false
        } finally {
            setBusy(false)
        }
    }

    function saveEdit() {
        const emails = athletes.map((athlete) => athlete.email)
        return run(() => {
            if (isCopa)
                return setCopaAthletes(participation.modality!.code, participation.copa_team!.id, emails)
            return updateParticipation(participation.id!, { ...detailsPayload(details), athletes: emails })
        })
    }

    async function remove() {
        setBusy(true)
        setError(null)
        try {
            await deleteParticipation(participation.id!)
            setConfirm(null)
            onDeleted?.()
        } catch (err) {
            setError(sportsErrorMessage(err, 'Não foi possível excluir.'))
            setConfirm(null)
        } finally {
            setBusy(false)
        }
    }

    return (
        <article className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <header className="flex flex-wrap items-center gap-3">
                <TrophyIcon color={color} className={`h-9 w-9 shrink-0 ${podium ? '' : 'opacity-60'}`} />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-100">{title(participation)}</p>
                    <p className="truncate text-xs text-zinc-400">{subtitle(participation)}</p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ color, borderColor: `${color}66` }}>
                    {participationResult(participation)}
                </span>
                {canEdit && mode === 'view' ? (
                    <span className="flex gap-1">
                        <button type="button" onClick={startEdit} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>
                            {isCopa ? 'Atletas' : 'Editar'}
                        </button>
                        {participation.id !== null && participation.athletes.length > 0 ? (
                            <button type="button" onClick={() => { setAwardTitle(''); setAwardees([]); setError(null); setMode('award') }} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>
                                + Premiação
                            </button>
                        ) : null}
                        {participation.id !== null && !isCopa ? (
                            <button type="button" onClick={() => setConfirm({ kind: 'delete' })} className={`${SMALL_BUTTON} text-red-300 hover:bg-red-950/50`}>Excluir</button>
                        ) : null}
                    </span>
                ) : null}
            </header>

            {error ? <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p> : null}

            {mode === 'edit' ? (
                <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-3">
                    {isCopa
                        ? <p className="text-xs text-zinc-500">O resultado vem direto da Copa ({participation.competition} {participation.year}). Aqui você escolhe quem jogou.</p>
                        : <ExternalDetailsFields value={details} onChange={setDetails} />}
                    <AthletesPicker selected={athletes} suggestions={suggestions} onChange={setAthletes} />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setMode('view')} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Cancelar</button>
                        <button
                            type="button"
                            disabled={busy || (!isCopa && !isValidDetails(details))}
                            onClick={() => void saveEdit()}
                            className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            ) : null}

            {mode === 'award' ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <label className="block space-y-1">
                        <span className="text-xs text-zinc-400">Premiação</span>
                        <input list="participation-awards" value={awardTitle} onChange={(event) => setAwardTitle(event.target.value)} maxLength={80} placeholder="Ex.: MVP da Final" className={INPUT_CLASS} />
                        <datalist id="participation-awards">{AWARD_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
                    </label>
                    <div className="space-y-1">
                        <span className="text-xs text-zinc-400">Para quem</span>
                        <ul className="grid gap-1 sm:grid-cols-2">
                            {participation.athletes.map((athlete) => (
                                <li key={athlete.email}>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm text-zinc-200 hover:bg-white/5">
                                        <input
                                            type="checkbox"
                                            checked={awardees.includes(athlete.email)}
                                            onChange={() => setAwardees(awardees.includes(athlete.email) ? awardees.filter((email) => email !== athlete.email) : [...awardees, athlete.email])}
                                            className="accent-red-600"
                                        />
                                        {athlete.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setMode('view')} className={`${SMALL_BUTTON} text-zinc-300 hover:bg-white/5`}>Cancelar</button>
                        <button
                            type="button"
                            disabled={busy || !awardTitle.trim() || awardees.length === 0}
                            onClick={() => void run(() => addParticipationAward(participation.id!, awardTitle.trim(), awardees))}
                            className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-500`}
                        >
                            Premiar
                        </button>
                    </div>
                </div>
            ) : null}

            {mode !== 'edit' ? (
                participation.athletes.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                        {participation.athletes.map((athlete) => (
                            <li key={athlete.email}>
                                <Link
                                    to={`/pessoas/${encodeURIComponent(athlete.email)}`}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-1 pr-3 text-xs text-zinc-200 transition hover:border-white/25"
                                >
                                    <span className="[&>*]:h-6 [&>*]:w-6 [&>*]:text-[9px]"><UserAvatar name={athlete.name} photo={athlete.profile_photo_url} /></span>
                                    {athlete.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-xs text-zinc-500">{isCopa ? 'Atletas ainda não informados.' : 'Nenhum atleta informado.'}</p>
            ) : null}

            {participation.awards.length > 0 ? (
                <ul className="space-y-1 border-t border-white/10 pt-3">
                    {participation.awards.map((award) => (
                        <li key={award.id} className="flex items-center gap-2 text-sm">
                            <MedalIcon className="h-5 w-5 shrink-0" />
                            <span className="font-medium text-zinc-100">{award.title}</span>
                            <span className="min-w-0 flex-1 truncate text-zinc-400">{award.recipients.map((recipient) => recipient.name).join(', ')}</span>
                            {canEdit && mode === 'view' ? (
                                <button type="button" onClick={() => setConfirm({ kind: 'award', award })} className="text-zinc-500 hover:text-red-300" aria-label={`Excluir ${award.title}`}>×</button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            ) : null}

            {confirm?.kind === 'delete' ? (
                <ConfirmDialog title="Excluir participação" confirmLabel="Excluir" danger busy={busy} onCancel={() => !busy && setConfirm(null)} onConfirm={() => void remove()}>
                    <p>
                        A participação em <strong className="text-zinc-100">{title(participation)}</strong> sai do histórico do time e do perfil de {participation.athletes.length}{' '}
                        {participation.athletes.length === 1 ? 'atleta' : 'atletas'}, junto com as premiações dadas nela.
                    </p>
                </ConfirmDialog>
            ) : null}
            {confirm?.kind === 'award' ? (
                <ConfirmDialog
                    title="Excluir premiação"
                    confirmLabel="Excluir"
                    danger
                    busy={busy}
                    onCancel={() => !busy && setConfirm(null)}
                    onConfirm={() => void run(() => deleteParticipationAward(participation.id!, confirm.award.id)).then(() => setConfirm(null))}
                >
                    <p>A premiação <strong className="text-zinc-100">{confirm.award.title}</strong> sai do perfil de {confirm.award.recipients.map((recipient) => recipient.name).join(', ')}.</p>
                </ConfirmDialog>
            ) : null}
        </article>
    )
}
