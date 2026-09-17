import { describe, expect, it } from 'vitest'
import { calcolaDateRinnovo, duplicaStruttura } from '@/features/plans/renewPlan'
import type { GiornoEspanso } from '@/types/domain'

const ORA = new Date(2026, 3, 15, 10, 0, 0) // 15 aprile 2026

describe('calcolaDateRinnovo', () => {
  it('riparte dal giorno dopo la fine, conservando la durata', () => {
    expect(
      calcolaDateRinnovo({ start_date: '2026-05-01', end_date: '2026-07-31' }, ORA),
    ).toEqual({ start_date: '2026-08-01', end_date: '2026-10-31' })
  })

  it('parte da oggi se la scheda è già scaduta', () => {
    // Fine il 1° marzo: ripartire dal 2 marzo vorrebbe dire creare un rinnovo
    // già scaduto in partenza.
    expect(
      calcolaDateRinnovo({ start_date: '2025-12-01', end_date: '2026-03-01' }, ORA),
    ).toEqual({ start_date: '2026-04-15', end_date: '2026-07-14' })
  })

  it('conserva la durata anche ripartendo da oggi', () => {
    const rinnovo = calcolaDateRinnovo(
      { start_date: '2026-01-01', end_date: '2026-01-31' },
      ORA,
    )
    expect(rinnovo.start_date).toBe('2026-04-15')
    expect(rinnovo.end_date).toBe('2026-05-15') // 30 giorni, come l'originale
  })

  it('lascia la fine aperta se non c’era una durata da conservare', () => {
    expect(calcolaDateRinnovo({ start_date: null, end_date: '2026-06-30' }, ORA)).toEqual({
      start_date: '2026-07-01',
      end_date: null,
    })
  })

  it('parte da oggi quando la scheda non ha date', () => {
    expect(calcolaDateRinnovo({ start_date: null, end_date: null }, ORA)).toEqual({
      start_date: '2026-04-15',
      end_date: null,
    })
  })

  it('gestisce una scheda di un giorno solo', () => {
    expect(
      calcolaDateRinnovo({ start_date: '2026-05-01', end_date: '2026-05-01' }, ORA),
    ).toEqual({ start_date: '2026-05-02', end_date: '2026-05-02' })
  })
})

function giorno(
  id: string,
  ordine: number,
  nome: string,
  esercizi: Array<[string, number]>,
): GiornoEspanso {
  return {
    id,
    plan_id: 'pl-1',
    day_order: ordine,
    day_name: nome,
    esercizi: esercizi.map(([exerciseId, indice]) => ({
      id: `${id}-${exerciseId}`,
      day_id: id,
      exercise_id: exerciseId,
      order_index: indice,
      sets: '4',
      reps: '8',
      rest_seconds: 90,
      tempo: null,
      notes: 'nota',
      esercizio: {
        id: exerciseId,
        name: exerciseId,
        muscle_group: null,
        description: null,
        media_url: null,
        media_type: null,
        media_attribution: null,
        archived: false,
        created_at: '',
        updated_at: '',
      },
    })),
  }
}

describe('duplicaStruttura', () => {
  it('copia giorni ed esercizi, non solo i giorni', () => {
    const copia = duplicaStruttura([
      giorno('d1', 0, 'Petto', [['ex-a', 0], ['ex-b', 1]]),
      giorno('d2', 1, 'Dorso', [['ex-c', 0]]),
    ])

    expect(copia.giorni).toHaveLength(2)
    expect(copia.giorni[0].esercizi.map((e) => e.exercise_id)).toEqual(['ex-a', 'ex-b'])
    expect(copia.giorni[1].esercizi.map((e) => e.exercise_id)).toEqual(['ex-c'])
  })

  it('porta con sé serie, ripetizioni, recupero e note', () => {
    const copia = duplicaStruttura([giorno('d1', 0, 'Petto', [['ex-a', 0]])])
    expect(copia.giorni[0].esercizi[0]).toMatchObject({
      sets: '4',
      reps: '8',
      rest_seconds: 90,
      notes: 'nota',
    })
  })

  it('rinumera in sequenza anche se le posizioni di partenza hanno buchi', () => {
    const copia = duplicaStruttura([
      giorno('d2', 5, 'Secondo', [['ex-b', 3]]),
      giorno('d1', 2, 'Primo', [['ex-a', 7], ['ex-c', 9]]),
    ])

    expect(copia.giorni.map((g) => [g.day_name, g.day_order])).toEqual([
      ['Primo', 0],
      ['Secondo', 1],
    ])
    expect(copia.giorni[0].esercizi.map((e) => e.order_index)).toEqual([0, 1])
  })

  it('non porta con sé gli id vecchi', () => {
    const copia = duplicaStruttura([giorno('d1', 0, 'Petto', [['ex-a', 0]])])
    expect(copia.giorni[0]).not.toHaveProperty('id')
    expect(copia.giorni[0].esercizi[0]).not.toHaveProperty('id')
  })

  it('regge una scheda senza giorni', () => {
    expect(duplicaStruttura([])).toEqual({ giorni: [] })
  })
})
