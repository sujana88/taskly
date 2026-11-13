import { describe, expect, it } from 'vitest'
import type { Task } from '../db/types'
import { buildColumns, findContainer, moveAcross, orderBetween, placement, reorderWithin } from './board'

const task = (id: string, status: Task['status'], order: number): Task => ({
  id, status, order, projectId: 'p', title: id, description: '', tags: [], subtasks: [], createdAt: '2026-01-01T00:00:00Z',
})

const tasks = [task('a', 'todo', 2000), task('b', 'todo', 1000), task('c', 'in_progress', 1000), task('d', 'done', 500)]

describe('board helpers', () => {
  it('groups by status and sorts by manual order', () => {
    expect(buildColumns(tasks)).toEqual({ todo: ['b', 'a'], in_progress: ['c'], in_revision: [], done: ['d'] })
  })

  it('finds the column of a card or of a column id', () => {
    const cols = buildColumns(tasks)
    expect(findContainer(cols, 'a')).toBe('todo')
    expect(findContainer(cols, 'in_revision')).toBe('in_revision')
    expect(findContainer(cols, 'zzz')).toBeUndefined()
  })

  it('moves a card into another column before the hovered card', () => {
    const cols = moveAcross(buildColumns(tasks), 'a', 'c')
    expect(cols.todo).toEqual(['b'])
    expect(cols.in_progress).toEqual(['a', 'c'])
  })

  it('moves a card to the end when hovering an empty column', () => {
    const cols = moveAcross(buildColumns(tasks), 'a', 'in_revision')
    expect(cols.in_revision).toEqual(['a'])
  })

  it('reorders inside a column', () => {
    expect(reorderWithin(buildColumns(tasks), 'b', 'a').todo).toEqual(['a', 'b'])
  })

  it('computes orders between neighbours', () => {
    expect(orderBetween()).toBe(1000)
    expect(orderBetween(undefined, 1000)).toBe(0)
    expect(orderBetween(1000)).toBe(2000)
    expect(orderBetween(1000, 2000)).toBe(1500)
  })

  it('places a dropped card between its new neighbours', () => {
    const byId = new Map(tasks.map((t) => [t.id, t.order]))
    const cols = moveAcross(buildColumns(tasks), 'b', 'd')
    expect(placement(cols, 'b', (id) => byId.get(id)!)).toEqual({ status: 'done', order: -500 })
  })
})
