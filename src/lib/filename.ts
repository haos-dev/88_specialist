/**
 * PRD §3.4: prima di `window.print()` l'app scrive `document.title`, perché è
 * quello che il browser propone come nome file in "Salva come PDF". Deve quindi
 * essere un nome file valido su Windows, macOS e Linux.
 */

// Vietati su Windows: \ / : * ? " < > |  — più i caratteri di controllo.
// eslint-disable-next-line no-control-regex
const VIETATI = /[\\/:*?"<>|\u0000-\u001f]/g

export function sanitizeNomeFile(valore: string): string {
  return valore
    .replace(VIETATI, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120)
}

/** 'Scheda - Mario Rossi - Ipertrofia Gennaio' */
export function nomeFileScheda(nomeCliente: string, titoloScheda: string): string {
  const parti = ['Scheda', nomeCliente, titoloScheda]
    .map((p) => sanitizeNomeFile(p ?? ''))
    .filter((p) => p.length > 0)
  return parti.join(' - ') || 'Scheda'
}
