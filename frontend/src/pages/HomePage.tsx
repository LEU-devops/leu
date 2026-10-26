export default function HomePage() {
    return (
        <main className="flex flex-1 items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-2xl rounded-3xl border border-red-950/50 bg-black/65 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-400">Leu</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Home</h1>
                <p className="mt-3 text-sm text-zinc-400">Em breve.</p>
            </div>
        </main>
    )
}
