import { describe, expect, it } from 'vitest'
import { calcolaScadenza, ordinaPerUrgenza } from '@/features/plans/planExpiry'
import type { Scadenza } from '@/types/domain'

/**
 * PRD §3.6 + audit B10. Il punto delicato è la mezzanotte locale: `oggi` è
 * costruito con i componenti locali della data, e queste prove usano un `now`
 * fissato per non dipendere dal momento in cui girano.
 */

// Mercoledì 15 aprile 2026, ore 10:00 locali.
const ORA = new Date(2026, 3, 15, 10, 0, 0)

function scheda(end_date: string | null, extra: Partial<{ status: string; clienteAttivo: boolean }> = {}) {
  return { end_date, status: 'active', clienteAttivo: true, ...extra }
}

describe('calcolaScadenza', () => {
  const casi: Record<string, { fine: string | null; atteso: Scadenza }> = {
    'scaduta ieri': { fine: '2026-04-14', atteso: { stato: 'scaduta', giorniResidui: -1 } },
    'scaduta da un mese': { fine: '2026-03-15', atteso: { stato: 'scaduta', giorniResidui: -31 } },
    'scade oggi': { fine: '2026-04-15', atteso: { stato: 'in-scadenza', giorniResidui: 0 } },
    'scade domani': { fine: '2026-04-16', atteso: { stato: 'in-scadenza', giorniResidui: 1 } },
    'ultimo giorno della soglia': {
      fine: '2026-04-22',
      atteso: { stato: 'in-scadenza', giorniResidui: 7 },
    },
    'primo giorno oltre la soglia': {
      fine: '2026-04-23',
      atteso: { stato: 'nessuna', giorniResidui: null },
    },
    'senza data di fine': { fine: null, atteso: { stato: 'nessuna', giorniResidui: null } },
  }

  for (const [nome, caso] of Object.entries(casi)) {
    it(nome, () => {
      expect(calcolaScadenza(scheda(caso.fine), 7, ORA)).toEqual(caso.atteso)
    })
  }

  it('esclude le schede archiviate', () => {
    expect(calcolaScadenza(scheda('2026-04-16', { status: 'archived' }), 7, ORA)).toEqual({
      stato: 'nessuna',
      giorniResidui: null,
    })
  })

  it('esclude le schede dei clienti archiviati', () => {
    expect(calcolaScadenza(scheda('2026-04-16', { clienteAttivo: false }), 7, ORA)).toEqual({
      stato: 'nessuna',
      giorniResidui: null,
    })
  })

  it('rispetta una soglia diversa da quella di default', () => {
    expect(calcolaScadenza(scheda('2026-05-10'), 30, ORA).stato).toBe('in-scadenza')
    expect(calcolaScadenza(scheda('2026-05-10'), 7, ORA).stato).toBe('nessuna')
  })

  it('con soglia 0 segnala solo le schede che scadono oggi o prima', () => {
    expect(calcolaScadenza(scheda('2026-04-15'), 0, ORA).stato).toBe('in-scadenza')
    expect(calcolaScadenza(scheda('2026-04-16'), 0, ORA).stato).toBe('nessuna')
    expect(calcolaScadenza(scheda('2026-04-14'), 0, ORA).stato).toBe('scaduta')
  })

  it('ricade sul default se la soglia è assurda', () => {
    expect(calcolaScadenza(scheda('2026-04-20'), Number.NaN, ORA).stato).toBe('in-scadenza')
    expect(calcolaScadenza(scheda('2026-04-20'), -5, ORA).stato).toBe('in-scadenza')
  })

  /**
   * Audit B10 — la prova che motiva `parseDataISO`. Alle 23:30 del 14 aprile
   * una scheda che finisce il 15 non è ancora scaduta. Confrontando i
   * millisecondi UTC (`new Date('2026-04-15')` = mezzanotte UTC = 02:00 locali
   * a Roma in ora legale) il risultato cambierebbe a seconda dell'ora.
   */
  it('non anticipa la scadenza a tarda sera', () => {
    const tardaSera = new Date(2026, 3, 14, 23, 30, 0)
    expect(calcolaScadenza(scheda('2026-04-15'), 7, tardaSera)).toEqual({
      stato: 'in-scadenza',
      giorniResidui: 1,
    })
  })

  it('non ritarda la scadenza a notte fonda', () => {
    const notteFonda = new Date(2026, 3, 15, 0, 30, 0)
    expect(calcolaScadenza(scheda('2026-04-14'), 7, notteFonda).stato).toBe('scaduta')
  })
})

describe('ordinaPerUrgenza', () => {
  it('mette prima le più scadute, poi le più imminenti', () => {
    const righe = [
      { id: 'b', scadenza: { stato: 'in-scadenza', giorniResidui: 5 } as Scadenza },
      { id: 'a', scadenza: { stato: 'scaduta', giorniResidui: -10 } as Scadenza },
      { id: 'c', scadenza: { stato: 'in-scadenza', giorniResidui: 0 } as Scadenza },
    ]
    expect(ordinaPerUrgenza(righe).map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('non muta l’array ricevuto', () => {
    const righe = [
      { scadenza: { stato: 'in-scadenza', giorniResidui: 3 } as Scadenza },
      { scadenza: { stato: 'scaduta', giorniResidui: -1 } as Scadenza },
    ]
    const copia = [...righe]
    ordinaPerUrgenza(righe)
    expect(righe).toEqual(copia)
  })
})
