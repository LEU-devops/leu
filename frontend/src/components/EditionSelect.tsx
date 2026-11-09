import { editionLabel, useEdition } from '../contexts/edition'
import Select from './Select'

/** Picks the Copa edition shown by the Copa pages; `onChange` lets a page reset its URL (a modality of another edition). */
export default function EditionSelect({ onChange, className = 'w-56' }: { onChange?: (id: number) => void, className?: string }) {
    const { editions, edition, setEditionId } = useEdition()
    if (editions.length === 0)
        return null
    return (
        <div className={className}>
            <Select
                value={edition?.id ?? ''}
                options={editions.map((row) => ({ value: row.id, label: `${editionLabel(row)}${row.is_current ? ' (atual)' : ''}` }))}
                onChange={(id) => {
                    setEditionId(id)
                    onChange?.(id)
                }}
            />
        </div>
    )
}
