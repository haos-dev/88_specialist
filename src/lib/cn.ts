type ClassValue = string | number | false | null | undefined

/** Unisce classi condizionali. Volutamente minimale: niente dipendenza esterna. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
