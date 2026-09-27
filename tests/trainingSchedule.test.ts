import { describe, expect, it } from 'vitest'
import {
  DURATA_LEZIONE_MINUTI,
  fineMassima,
  fineProposta,
  generaLezioni,
  titoloLezione,
} from '@/features/clients/trainingSchedule'

/** Lunedì 28 settembre 2026, ore 09:00 locali. */
const LUNEDI_MATTINA = new Date(2026, 8, 28, 9, 0)

const date = (lezioni: { appointment_date: string; start_time: string }[]) =>
  lezioni.map((l) => `${l.appointment_date} ${l.start_time}`)

describe('generaLezioni', () => {
  it('lunedì 13:30 e venerdì 15:30 per un mese: una lezione per ogni lunedì e venerdì', () => {
    const lezioni = generaLezioni(
      [
        { giorno: 1, ora: '13:30' },
        { giorno: 5, ora: '15:30' },
      ],
      fineProposta(LUNEDI_MATTINA),
      'Lezione Mario Rossi',
      LUNEDI_MATTINA,
    )
    expect(date(lezioni)).toEqual([
      '2026-09-28 13:30:00',
      '2026-10-02 15:30:00',
      '2026-10-05 13:30:00',
      '2026-10-09 15:30:00',
      '2026-10-12 13:30:00',
      '2026-10-16 15:30:00',
      '2026-10-19 13:30:00',
      '2026-10-23 15:30:00',
      '2026-10-26 13:30:00',
    ])
    for (const l of lezioni) {
      expect(l.title).toBe('Lezione Mario Rossi')
      expect(l.duration_minutes).toBe(DURATA_LEZIONE_MINUTI)
      expect(l.notes).toBeNull()
    }
  })

  it('la data di fine è inclusa', () => {
    const lezioni = generaLezioni([{ giorno: 1, ora: '18:00' }], '2026-10-05', 'L', LUNEDI_MATTINA)
    expect(date(lezioni)).toEqual(['2026-09-28 18:00:00', '2026-10-05 18:00:00'])
  })

  it("salta la lezione di oggi se l'orario è già passato", () => {
    const pomeriggio = new Date(2026, 8, 28, 14, 0)
    const lezioni = generaLezioni(
      [{ giorno: 1, ora: '13:30' }],
      '2026-10-05',
      'L',
      pomeriggio,
    )
    expect(date(lezioni)).toEqual(['2026-10-05 13:30:00'])
  })

  it("salta anche quella che inizia esattamente adesso, e tiene quella più tardi", () => {
    const allUnaEMezza = new Date(2026, 8, 28, 13, 30)
    expect(
      date(generaLezioni([{ giorno: 1, ora: '13:30' }], '2026-09-28', 'L', allUnaEMezza)),
    ).toEqual([])
    expect(
      date(generaLezioni([{ giorno: 1, ora: '13:31' }], '2026-09-28', 'L', allUnaEMezza)),
    ).toEqual(['2026-09-28 13:31:00'])
  })

  it('attraversa la fine del mese', () => {
    const venerdi = new Date(2026, 0, 30, 8, 0)
    const lezioni = generaLezioni([{ giorno: 5, ora: '07:00' }], '2026-02-13', 'L', venerdi)
    // Il 30 gennaio alle 07:00 è già passato alle 08:00.
    expect(date(lezioni)).toEqual(['2026-02-06 07:00:00', '2026-02-13 07:00:00'])
  })

  it("il cambio d'ora non sposta né data né orario", () => {
    // 25 ottobre 2026: fine dell'ora legale in Europa.
    const lezioni = generaLezioni(
      [{ giorno: 7, ora: '10:00' }],
      '2026-11-01',
      'L',
      new Date(2026, 9, 17, 12, 0),
    )
    expect(date(lezioni)).toEqual([
      '2026-10-18 10:00:00',
      '2026-10-25 10:00:00',
      '2026-11-01 10:00:00',
    ])
  })

  it('nessun giorno scelto, fine nel passato o non valida: nessuna lezione', () => {
    expect(generaLezioni([], '2026-10-28', 'L', LUNEDI_MATTINA)).toEqual([])
    expect(generaLezioni([{ giorno: 1, ora: '10:00' }], '2026-09-27', 'L', LUNEDI_MATTINA)).toEqual([])
    expect(generaLezioni([{ giorno: 1, ora: '10:00' }], '', 'L', LUNEDI_MATTINA)).toEqual([])
  })
})

describe('date del form', () => {
  it('propone un mese esatto, ultimo giorno incluso', () => {
    expect(fineProposta(LUNEDI_MATTINA)).toBe('2026-10-27')
  })

  it('limita la fine a dodici mesi da oggi', () => {
    expect(fineMassima(LUNEDI_MATTINA)).toBe('2027-09-28')
  })
})

describe('titoloLezione', () => {
  it('usa nome e cognome, senza spazi di troppo', () => {
    expect(titoloLezione(' Mario ', 'Rossi ')).toBe('Lezione Mario Rossi')
  })
})
