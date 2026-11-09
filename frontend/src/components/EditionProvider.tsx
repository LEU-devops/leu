import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { EditionContext } from '../contexts/edition'
import { getEditions } from '../services/competition'
import type { CopaEdition } from '../types/competition'

const STORAGE_KEY = 'leu_copa_edition'

function storedId(): number | null {
    try {
        const value = Number(localStorage.getItem(STORAGE_KEY))
        return Number.isInteger(value) && value > 0 ? value : null
    } catch {
        return null
    }
}

/** Loads the Copa editions and remembers which one the viewer is looking at (per browser). */
export default function EditionProvider({ children }: { children: ReactNode }) {
    const [editions, setEditions] = useState<CopaEdition[]>([])
    const [pickedId, setPickedId] = useState<number | null>(storedId)

    const reload = useCallback(async () => {
        setEditions(await getEditions())
    }, [])

    useEffect(() => {
        getEditions().then(setEditions).catch(() => setEditions([]))
    }, [])

    const setEditionId = useCallback((id: number) => {
        setPickedId(id)
        try {
            localStorage.setItem(STORAGE_KEY, String(id))
        } catch {
            // Private mode: the choice just is not remembered.
        }
    }, [])

    const value = useMemo(() => ({
        editions,
        edition: editions.find((row) => row.id === pickedId) ?? editions.find((row) => row.is_current) ?? editions[0] ?? null,
        setEditionId,
        reload,
    }), [editions, pickedId, setEditionId, reload])

    return <EditionContext.Provider value={value}>{children}</EditionContext.Provider>
}
