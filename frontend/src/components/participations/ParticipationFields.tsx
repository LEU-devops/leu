import Select from '../Select'
import { UserAvatar, UserSearch } from '../UserSearch'
import type { Athlete } from '../../types/sports'
import type { ExternalDetails } from '../../utils/participations'

const INPUT_CLASS =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600'

const COMPETITION_SUGGESTIONS = ['TUSCA', 'InterLEU', 'Liga Universitária', 'JUCA', 'Copa Unicamp', 'Engenharíadas']

type ResultChoice = 'participacao' | '1' | '2' | '3' | 'outra'

const RESULT_OPTIONS: { value: ResultChoice, label: string }[] = [
    { value: 'participacao', label: 'Participação' },
    { value: '1', label: 'Ouro (1º)' },
    { value: '2', label: 'Prata (2º)' },
    { value: '3', label: 'Bronze (3º)' },
    { value: 'outra', label: 'Outra colocação' },
]

/** Championship name, year and result of an externo participation. */
export function ExternalDetailsFields({ value, onChange }: { value: ExternalDetails, onChange: (value: ExternalDetails) => void }) {
    const choice: ResultChoice = value.placement === '' ? 'participacao' : ['1', '2', '3'].includes(value.placement) ? value.placement as ResultChoice : 'outra'
    return (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.5fr]">
            <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Campeonato</span>
                <input
                    list="participation-competitions"
                    value={value.competition}
                    onChange={(event) => onChange({ ...value, competition: event.target.value })}
                    maxLength={80}
                    placeholder="Ex.: TUSCA"
                    className={INPUT_CLASS}
                />
                <datalist id="participation-competitions">{COMPETITION_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
            </label>
            <label className="block space-y-1">
                <span className="text-xs text-zinc-400">Ano</span>
                <input type="number" min={1950} max={2100} value={value.year} onChange={(event) => onChange({ ...value, year: event.target.value })} className={INPUT_CLASS} />
            </label>
            <div className="space-y-1">
                <span className="text-xs text-zinc-400">Resultado</span>
                <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                        <Select
                            value={choice}
                            options={RESULT_OPTIONS}
                            onChange={(next) => onChange({ ...value, placement: next === 'participacao' ? '' : next === 'outra' ? '4' : next })}
                        />
                    </div>
                    {choice === 'outra' ? (
                        <input
                            type="number"
                            min={4}
                            value={value.placement}
                            onChange={(event) => onChange({ ...value, placement: event.target.value })}
                            aria-label="Colocação"
                            className={`${INPUT_CLASS} w-20`}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    )
}

/**
 * Who played: the suggested people (e.g. the team roster) as checkboxes, plus anyone else found
 * by searching.
 */
export function AthletesPicker({ selected, suggestions, onChange }: { selected: Athlete[], suggestions: Athlete[], onChange: (athletes: Athlete[]) => void }) {
    const isSelected = (email: string) => selected.some((athlete) => athlete.email === email)
    const suggested = new Set(suggestions.map((athlete) => athlete.email))
    const others = selected.filter((athlete) => !suggested.has(athlete.email))

    return (
        <div className="space-y-2">
            <span className="text-xs text-zinc-400">Atletas que jogaram ({selected.length})</span>
            {suggestions.length > 0 ? (
                <ul className="grid gap-1 sm:grid-cols-2">
                    {suggestions.map((athlete) => (
                        <li key={athlete.email}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm text-zinc-200 hover:bg-white/5">
                                <input
                                    type="checkbox"
                                    checked={isSelected(athlete.email)}
                                    onChange={() => onChange(isSelected(athlete.email) ? selected.filter((item) => item.email !== athlete.email) : [...selected, athlete])}
                                    className="accent-red-600"
                                />
                                {athlete.name}
                            </label>
                        </li>
                    ))}
                </ul>
            ) : null}
            {others.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                    {others.map((athlete) => (
                        <li key={athlete.email} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-1 pr-3 text-sm text-zinc-200">
                            <span className="[&>*]:h-6 [&>*]:w-6 [&>*]:text-[9px]"><UserAvatar name={athlete.name} photo={athlete.profile_photo_url} /></span>
                            {athlete.name}
                            <button type="button" onClick={() => onChange(selected.filter((item) => item.email !== athlete.email))} className="text-zinc-500 hover:text-zinc-200" aria-label={`Remover ${athlete.name}`}>
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            <UserSearch
                isTaken={isSelected}
                takenLabel="Já incluído"
                placeholder={suggestions.length > 0 ? 'Incluir alguém de fora da lista' : 'Buscar atleta por nome, apelido ou e-mail'}
                onPick={(user) => onChange([...selected, { email: user.email, name: user.full_name || user.name, profile_photo_url: user.profile_photo_url }])}
            />
        </div>
    )
}
