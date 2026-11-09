/** Today as "YYYY-MM-DD" in Brazil's time zone (dates of periods are calendar days there). */
export function today(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Whether `value` is a real calendar day written as "YYYY-MM-DD". */
export function isIsoDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
