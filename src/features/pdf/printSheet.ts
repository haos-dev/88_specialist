import { nomeFileScheda } from '@/lib/filename'

/**
 * PRD §3.4 + audit B4 — la stampa nativa del browser, fatta bene.
 *
 * Tre cose che il PRD non dice ma senza cui l'export esce sbagliato:
 *   1. `window.print()` non aspetta le immagini. Logo e gif degli esercizi
 *      arrivano da Supabase Storage: se si stampa subito, il PDF esce bucato.
 *   2. `document.title` diventa il nome file proposto in "Salva come PDF",
 *      quindi deve essere un nome file valido (vedi `lib/filename.ts`).
 *   3. Quel titolo va rimesso a posto dopo, o la scheda del browser resta
 *      intestata al nome del file.
 */

/** Aspetta che tutte le immagini abbiano finito, con un tetto di tempo. */
export async function attendiImmagini(
  radice: ParentNode = document,
  timeoutMs = 8000,
): Promise<void> {
  const immagini = Array.from(radice.querySelectorAll('img'))
  if (immagini.length === 0) return

  const caricate = immagini.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve()
          return
        }
        // Un'immagine rotta non deve bloccare la stampa: `error` risolve
        // comunque, il foglio esce senza quella figura invece che mai.
        const fine = () => resolve()
        img.addEventListener('load', fine, { once: true })
        img.addEventListener('error', fine, { once: true })
      }),
  )

  // Se un URL resta appeso, dopo il timeout si stampa lo stesso.
  await Promise.race([
    Promise.all(caricate),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])

  // I font vanno attesi a parte: il testo misurato con il fallback manda a
  // capo diversamente e può spostare le interruzioni di pagina.
  if ('fonts' in document) {
    await Promise.race([
      document.fonts.ready.then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ])
  }
}

interface OpzioniStampa {
  nomeCliente: string
  titoloScheda: string
}

/** Prepara il titolo, aspetta il caricamento, stampa, rimette il titolo. */
export async function stampaScheda({ nomeCliente, titoloScheda }: OpzioniStampa): Promise<void> {
  const titoloPrecedente = document.title
  document.title = nomeFileScheda(nomeCliente, titoloScheda)

  try {
    await attendiImmagini()
    window.print()
  } finally {
    // `window.print()` è sincrono e bloccante in tutti i browser desktop, ma
    // il ripristino passa comunque dal task successivo: in Safari la finestra
    // di stampa può leggere il titolo un attimo dopo.
    setTimeout(() => {
      document.title = titoloPrecedente
    }, 500)
  }
}
