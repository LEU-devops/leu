import { useRef, useState, type FormEvent } from 'react'
import { createEvent, type EventsView } from '../../services/competition'
import { EVENT_FLAGS, type EventFlags } from '../../types/competition'
import EventFlagsFields from './EventFlagsFields'
import { ERROR_BOX, errorMessage, INPUT_CLASS, PRIMARY_BUTTON } from './shared'

interface Props {
    code: string
    onChange: (view: EventsView) => void
}

/** Adds an event to the modality: a name and how it scores (revezamento and/or demonstrativa). */
export default function NewEventForm({ code, onChange }: Props) {
    const [name, setName] = useState('')
    const [flags, setFlags] = useState<EventFlags>({ demonstrativa: false, revezamento: false })
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const nameInput = useRef<HTMLInputElement>(null)

    async function add(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        setError(null)
        setIsSaving(true)
        try {
            onChange(await createEvent(code, trimmed, flags))
            setName('') // keep the flags, so several relays can be added in a row
            nameInput.current?.focus()
        } catch (saveError) {
            setError(errorMessage(saveError, 'Não foi possível adicionar a prova.'))
        } finally {
            setIsSaving(false)
        }
    }

    const hint = EVENT_FLAGS.filter((f) => flags[f.key]).map((f) => f.hint.toLowerCase()).join(' · ') || 'Pontua pela tabela, até 2 atletas por time'

    return (
        <div className="rounded-2xl border border-white/10 bg-black/65 p-4">
            <form className="flex flex-wrap items-end gap-2" onSubmit={add}>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
                    Nova prova
                    <input ref={nameInput} className={`${INPUT_CLASS} w-52`} value={name} required placeholder="Ex.: 100m rasos" disabled={isSaving} onChange={(e) => setName(e.target.value)} />
                </label>
                <EventFlagsFields value={flags} disabled={isSaving} onChange={setFlags} />
                <button type="submit" className={PRIMARY_BUTTON} disabled={isSaving || !name.trim()}>
                    {isSaving ? 'Adicionando...' : 'Adicionar'}
                </button>
                <span className="pb-2 text-xs text-zinc-500">{hint}</span>
            </form>
            {error ? <p className={`${ERROR_BOX} mt-3`}>{error}</p> : null}
        </div>
    )
}
