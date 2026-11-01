import { useState } from 'react'
import { setRegistrations, type EventsView } from '../../services/competition'
import type { Team } from '../../types/competition'
import TeamLogo from '../bracket/TeamLogo'
import { ERROR_BOX, errorMessage } from './shared'

interface Props {
    code: string
    /** Teams registered in the modality. */
    registered: Team[]
    /** Every team of the competition, to register from. */
    allTeams: Team[]
    canEdit: boolean
    onChange: (view: EventsView) => void
}

/**
 * Who takes part in the modality. Registration is per modality, not per event: the registered
 * teams are the options of every event, and their number picks the points table of the overall standings.
 */
export default function RegistrationsSection({ code, registered, allTeams, canEdit, onChange }: Props) {
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)
    const registeredIds = new Set(registered.map((t) => t.id))

    async function toggle(team: Team) {
        const next = registeredIds.has(team.id) ? registered.filter((t) => t.id !== team.id) : [...registered, team]
        setError(null)
        setBusyId(team.id)
        try {
            onChange(await setRegistrations(code, next.map((t) => t.id)))
        } catch (saveError) {
            setError(errorMessage(saveError, 'Não foi possível alterar as inscrições.'))
        } finally {
            setBusyId(null)
        }
    }

    const teams = canEdit ? allTeams : registered

    return (
        <section className="space-y-3">
            <div>
                <h3 className="text-lg font-semibold tracking-tight text-zinc-50">Inscrições</h3>
                <p className="text-sm text-zinc-400">
                    {canEdit
                        ? 'Clique em um time para inscrever ou retirar. Os inscritos são as opções de cada prova; o número de inscritos define a tabela de pontos da colocação final na geral.'
                        : 'Times inscritos na modalidade. O número de inscritos define a tabela de pontos da colocação final na geral.'}
                </p>
            </div>

            {error ? <p className={ERROR_BOX}>{error}</p> : null}

            {teams.length === 0 ? (
                <p className="text-sm text-zinc-500">{canEdit ? 'Nenhum time cadastrado na competição.' : 'Nenhum time inscrito.'}</p>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {teams.map((team) => {
                        const isRegistered = registeredIds.has(team.id)
                        const isBusy = busyId === team.id
                        const chip = `flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition ${
                            isRegistered ? 'border-red-600/60 bg-red-950/40 text-zinc-50' : 'border-white/10 bg-white/5 text-zinc-500'
                        }`
                        return (
                            <li key={team.id}>
                                {canEdit ? (
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isRegistered}
                                        disabled={isBusy}
                                        onClick={() => toggle(team)}
                                        className={`${chip} hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50`}
                                    >
                                        <TeamLogo name={team.name} className={`h-5 w-5 ${isRegistered ? '' : 'opacity-50 grayscale'}`} />
                                        <span>{team.name}</span>
                                        <span className={`text-xs ${isRegistered ? 'text-red-400' : 'text-zinc-600'}`}>{isBusy ? '…' : isRegistered ? '✓' : '+'}</span>
                                    </button>
                                ) : (
                                    <span className={chip}>
                                        <TeamLogo name={team.name} className="h-5 w-5" />
                                        <span>{team.name}</span>
                                    </span>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}
