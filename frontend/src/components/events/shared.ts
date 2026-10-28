export const INPUT_CLASS =
    'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-zinc-50 outline-none transition placeholder:text-zinc-600 focus:border-red-600 disabled:opacity-50 [color-scheme:dark]'
export const PRIMARY_BUTTON =
    'rounded-xl bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50'
export const GHOST_BUTTON = 'rounded-lg px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 disabled:opacity-50'
export const ERROR_BOX = 'rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200'

/** The message of an API error, translated for the events pages. */
export function errorMessage(error: unknown, fallback: string): string {
    const text = error instanceof Error ? error.message : ''
    if (text.includes('status: 403')) return 'Você não tem permissão para editar as provas.'
    const match = text.match(/"message":"([^"]+)"/)
    if (!match) return fallback
    const message = match[1]
    if (message.includes('already placed in an event')) return `${message.split(' already')[0]} já tem resultado em alguma prova. Limpe esses resultados antes de remover a inscrição.`
    if (message.includes('already exists')) return 'Já existe uma prova com esse nome nesta modalidade.'
    if (message.includes('not registered')) return 'Esse time não está inscrito na modalidade.'
    return message
}
