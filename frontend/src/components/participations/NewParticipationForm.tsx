import { useState } from 'react'
import { AthletesPicker, ExternalDetailsFields } from './ParticipationFields'
import { createParticipation, sportsErrorMessage } from '../../services/sports'
import type { Athlete, Participation } from '../../types/sports'
import { detailsPayload, isValidDetails, type ExternalDetails } from '../../utils/participations'

/** Registers a championship the team played (outside the LEU Copas), with its athletes. */
export default function NewParticipationForm({ teamId, roster, onCreated, onCancel }: {
    teamId: number
    roster: Athlete[]
    onCreated: (participation: Participation) => void
    onCancel: () => void
}) {
    const [details, setDetails] = useState<ExternalDetails>({ competition: '', year: String(new Date().getFullYear()), placement: '' })
    const [athletes, setAthletes] = useState<Athlete[]>(roster)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit() {
        setBusy(true)
        setError(null)
        try {
            onCreated(await createParticipation({ sports_team_id: teamId, ...detailsPayload(details), athletes: athletes.map((athlete) => athlete.email) }))
        } catch (err) {
            setError(sportsErrorMessage(err))
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Nova participação</p>
            <ExternalDetailsFields value={details} onChange={setDetails} />
            <AthletesPicker selected={athletes} suggestions={roster} onChange={setAthletes} />
            <p className="text-[11px] text-zinc-500">Premiações individuais (MVP, destaque...) são adicionadas depois, no card da participação. As Copas da LEU não entram aqui: o resultado delas vem da própria Copa.</p>
            {error ? <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p> : null}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/5">Cancelar</button>
                <button
                    type="button"
                    disabled={busy || !isValidDetails(details)}
                    onClick={() => void submit()}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-500 disabled:opacity-40"
                >
                    Registrar
                </button>
            </div>
        </div>
    )
}
