import { EVENT_FLAGS, type EventFlags } from '../../types/competition'

interface Props {
    value: EventFlags
    disabled?: boolean
    onChange: (flags: EventFlags) => void
}

/** The two independent checkboxes that say how an event scores. */
export default function EventFlagsFields({ value, disabled, onChange }: Props) {
    return (
        <>
            {EVENT_FLAGS.map((flag) => (
                <label key={flag.key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition has-checked:border-red-600/60 has-checked:bg-red-950/40" title={flag.hint}>
                    <input
                        type="checkbox"
                        className="accent-red-600"
                        checked={value[flag.key]}
                        disabled={disabled}
                        onChange={(e) => onChange({ ...value, [flag.key]: e.target.checked })}
                    />
                    {flag.label}
                </label>
            ))}
        </>
    )
}
