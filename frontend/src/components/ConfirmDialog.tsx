import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
    title: string
    children: ReactNode
    confirmLabel: string
    cancelLabel?: string
    /** Red confirm button for destructive actions. */
    danger?: boolean
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancelar', danger = false, busy = false, onConfirm, onCancel }: Props) {
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && !busy)
                onCancel()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [busy, onCancel])

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => !busy && onCancel()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="border-b border-white/10 px-6 py-4 text-lg font-semibold text-zinc-50">{title}</h2>
                <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-zinc-300">{children}</div>
                <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        autoFocus
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            danger ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500'
                        }`}
                    >
                        {busy ? 'Salvando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
