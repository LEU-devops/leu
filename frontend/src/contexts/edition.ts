import { createContext, useContext } from 'react'
import type { CopaEdition } from '../types/competition'

export interface EditionState {
    /** Newest first; empty while loading. */
    editions: CopaEdition[]
    /** The edition the Copa pages show: the one picked by the viewer, else the current one. */
    edition: CopaEdition | null
    setEditionId: (id: number) => void
    /** Re-reads the list, e.g. after an edition was created or renamed. */
    reload: () => Promise<void>
}

export const EditionContext = createContext<EditionState>({
    editions: [],
    edition: null,
    setEditionId: () => undefined,
    reload: async () => undefined,
})

export function useEdition(): EditionState {
    return useContext(EditionContext)
}

export function editionLabel(edition: Pick<CopaEdition, 'name' | 'year'>): string {
    return `${edition.name} ${edition.year}`
}
