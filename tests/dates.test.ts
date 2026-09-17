import { describe, expect, it } from 'vitest'
import {
  durataGiorni,
  formatData,
  formatGiorniResidui,
  formatIntervallo,
  giorniDaOggi,
  oggi,
  parseDataISO,
  spostaData,
  toDataISO,
} from '@/lib/dates'

describe('parseDataISO', () => {
  /**
   * Audit B10, il motivo per cui questa funzione esiste: `new Date('...')`
   * interpreta una data-only come UTC, questa la interpreta come locale.
   */
  it('legge la data nel fuso locale, non in UTC', () => {
    const d = parseDataISO('2026-04-15')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(3)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(0)
  })

  it('accetta un timestamp completo tenendo solo la parte data', () => {
    expect(parseDataISO('2026-04-15T22:30:00Z')!.getDate()).toBe(15)
  })

  it('restituisce null su valori mancanti o non validi', () => {
    expect(parseDataISO(null)).toBeNull()
    expect(parseDataISO(undefined)).toBeNull()
    expect(parseDataISO('')).toBeNull()
    expect(parseDataISO('non-una-data')).toBeNull()
  })
})

describe('oggi / toDataISO', () => {
  it('azzera l’orario restando nel giorno locale', () => {
    const d = oggi(new Date(2026, 3, 15, 23, 59, 59))
    expect(toDataISO(d)).toBe('2026-04-15')
    expect(d.getHours()).toBe(0)
  })

  it('sopravvive al cambio di giorno visto alle 00:01', () => {
    expect(toDataISO(oggi(new Date(2026, 3, 15, 0, 1)))).toBe('2026-04-15')
  })
})

describe('formattazione in italiano', () => {
  it('formatData usa i mesi abbreviati italiani', () => {
    expect(formatData('2026-01-05')).toBe('5 gen 2026')
    expect(formatData('2026-08-21')).toBe('21 ago 2026')
  })

  it('formatData mostra un trattino se la data manca', () => {
    expect(formatData(null)).toBe('—')
  })

  it('formatIntervallo omette l’anno all’inizio quando è lo stesso', () => {
    expect(formatIntervallo('2026-01-01', '2026-03-31')).toBe('1 gen – 31 mar 2026')
  })

  it('formatIntervallo scrive entrambi gli anni quando differiscono', () => {
    expect(formatIntervallo('2025-11-01', '2026-02-28')).toBe('1 nov 2025 – 28 feb 2026')
  })

  it('formatIntervallo gestisce i periodi aperti', () => {
    expect(formatIntervallo('2026-01-01', null)).toBe('Dal 1 gen 2026')
    expect(formatIntervallo(null, '2026-03-31')).toBe('Fino al 31 mar 2026')
    expect(formatIntervallo(null, null)).toBe('Nessun periodo indicato')
  })
})

describe('formatGiorniResidui', () => {
  const casi: Array<[number, string]> = [
    [0, 'scade oggi'],
    [1, 'scade domani'],
    [12, 'scade tra 12 giorni'],
    [-1, 'scaduta ieri'],
    [-5, 'scaduta da 5 giorni'],
  ]
  for (const [giorni, atteso] of casi) {
    it(`${giorni} → "${atteso}"`, () => {
      expect(formatGiorniResidui(giorni)).toBe(atteso)
    })
  }
})

describe('aritmetica delle date', () => {
  it('giorniDaOggi conta i giorni di calendario', () => {
    const ora = new Date(2026, 3, 15, 10, 0)
    expect(giorniDaOggi('2026-04-20', ora)).toBe(5)
    expect(giorniDaOggi('2026-04-15', ora)).toBe(0)
    expect(giorniDaOggi('2026-04-10', ora)).toBe(-5)
    expect(giorniDaOggi(null, ora)).toBeNull()
  })

  it('spostaData attraversa i confini di mese e anno', () => {
    expect(spostaData('2026-01-31', 1)).toBe('2026-02-01')
    expect(spostaData('2026-12-31', 1)).toBe('2027-01-01')
    expect(spostaData('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('spostaData gestisce il 29 febbraio di un anno bisestile', () => {
    expect(spostaData('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('durataGiorni misura la distanza fra due date', () => {
    expect(durataGiorni('2026-01-01', '2026-01-31')).toBe(30)
    expect(durataGiorni('2026-01-01', '2026-01-01')).toBe(0)
    expect(durataGiorni('2026-01-01', 'boh')).toBeNull()
  })
})
