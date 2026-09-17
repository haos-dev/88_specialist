import { describe, expect, it } from 'vitest'
import { nomeFileScheda, sanitizeNomeFile } from '@/lib/filename'

/**
 * Audit B4 — `document.title` diventa il nome file proposto in "Salva come
 * PDF", quindi deve essere un nome file valido. Su Windows i caratteri
 * \ / : * ? " < > | fanno fallire il salvataggio senza spiegare perché.
 */
describe('sanitizeNomeFile', () => {
  it('toglie i caratteri vietati da Windows', () => {
    expect(sanitizeNomeFile('A/B\\C:D*E?F"G<H>I|J')).toBe('A B C D E F G H I J')
  })

  it('collassa gli spazi multipli lasciati dalla pulizia', () => {
    expect(sanitizeNomeFile('Scheda///Mario')).toBe('Scheda Mario')
  })

  it('toglie punti e spazi in testa e in coda', () => {
    // Un nome che finisce con un punto è invalido su Windows.
    expect(sanitizeNomeFile('  .Scheda.  ')).toBe('Scheda')
  })

  it('tiene le lettere accentate: sono legali e servono', () => {
    expect(sanitizeNomeFile('Attività — Nicolò Èlia')).toBe('Attività — Nicolò Èlia')
  })

  it('taglia i nomi assurdamente lunghi', () => {
    expect(sanitizeNomeFile('x'.repeat(500))).toHaveLength(120)
  })

  it('restituisce stringa vuota se non resta niente di valido', () => {
    expect(sanitizeNomeFile('///')).toBe('')
    expect(sanitizeNomeFile('   ')).toBe('')
  })
})

describe('nomeFileScheda', () => {
  it('compone il nome nella forma attesa', () => {
    expect(nomeFileScheda('Mario Rossi', 'Ipertrofia Gennaio')).toBe(
      'Scheda - Mario Rossi - Ipertrofia Gennaio',
    )
  })

  it('pulisce anche le parti che arrivano dai dati', () => {
    expect(nomeFileScheda('Mario/Rossi', 'Forza: blocco 1')).toBe(
      'Scheda - Mario Rossi - Forza blocco 1',
    )
  })

  it('salta le parti che si svuotano invece di lasciare trattini appesi', () => {
    expect(nomeFileScheda('Mario Rossi', '///')).toBe('Scheda - Mario Rossi')
    expect(nomeFileScheda('', '')).toBe('Scheda')
  })
})
