import { describe, expect, it } from 'vitest'
import { rinumera, riordinoMinimo, spostaElemento } from '@/features/plans/reorder'

const elenco = (ids: string[]) => ids.map((id, i) => ({ id, position: i }))

describe('spostaElemento', () => {
  it('sposta in avanti', () => {
    expect(spostaElemento(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('sposta all’indietro', () => {
    expect(spostaElemento(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('non fa nulla se origine e destinazione coincidono', () => {
    expect(spostaElemento(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('ignora gli indici fuori intervallo invece di corrompere l’array', () => {
    expect(spostaElemento(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(spostaElemento(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })

  it('non muta l’array ricevuto', () => {
    const originale = ['a', 'b', 'c']
    spostaElemento(originale, 0, 2)
    expect(originale).toEqual(['a', 'b', 'c'])
  })
})

describe('riordinoMinimo', () => {
  it('emette solo le righe che hanno davvero cambiato posizione', () => {
    // a b c d  →  b a c d: si muovono solo i primi due.
    expect(riordinoMinimo(elenco(['a', 'b', 'c', 'd']), [{ id: 'b' }, { id: 'a' }, { id: 'c' }, { id: 'd' }]))
      .toEqual([
        { id: 'b', position: 0 },
        { id: 'a', position: 1 },
      ])
  })

  it('non emette niente se l’ordine non è cambiato', () => {
    expect(riordinoMinimo(elenco(['a', 'b', 'c']), [{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual([])
  })

  it('spostare il primo in fondo tocca tutte le righe', () => {
    expect(riordinoMinimo(elenco(['a', 'b', 'c']), [{ id: 'b' }, { id: 'c' }, { id: 'a' }])).toEqual([
      { id: 'b', position: 0 },
      { id: 'c', position: 1 },
      { id: 'a', position: 2 },
    ])
  })

  /**
   * Audit B2: è questo che tiene piccolo l'upsert. Scambiare gli ultimi due
   * di dieci righe deve produrre due update, non dieci.
   */
  it('scambiare due vicini in una lista lunga produce due sole scritture', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `x${i}`)
    const nuovo = spostaElemento(ids, 8, 9).map((id) => ({ id }))
    expect(riordinoMinimo(elenco(ids), nuovo)).toHaveLength(2)
  })

  it('rinumera correttamente anche se le posizioni di partenza avevano buchi', () => {
    const attuale = [
      { id: 'a', position: 3 },
      { id: 'b', position: 7 },
    ]
    expect(riordinoMinimo(attuale, [{ id: 'a' }, { id: 'b' }])).toEqual([
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
    ])
  })
})

describe('rinumera', () => {
  it('riscrive day_order in sequenza da zero', () => {
    const giorni = [
      { id: 'a', day_order: 4 },
      { id: 'b', day_order: 9 },
    ]
    expect(rinumera(giorni, 'day_order')).toEqual([
      { id: 'a', day_order: 0 },
      { id: 'b', day_order: 1 },
    ])
  })

  it('riscrive order_index in sequenza da zero', () => {
    const righe = [
      { id: 'a', order_index: 2 },
      { id: 'b', order_index: 0 },
    ]
    expect(rinumera(righe, 'order_index')).toEqual([
      { id: 'a', order_index: 0 },
      { id: 'b', order_index: 1 },
    ])
  })
})
