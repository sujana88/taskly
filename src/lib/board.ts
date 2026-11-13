import { STATUSES, type Status, type Task } from '../db/types'

export type Columns = Record<Status, string[]>

export function emptyColumns(): Columns {
  return { todo: [], in_progress: [], in_revision: [], done: [] }
}

/** Group task ids by status, each column sorted by manual order. */
export function buildColumns(tasks: Task[]): Columns {
  const cols = emptyColumns()
  for (const t of [...tasks].sort((a, b) => a.order - b.order)) cols[t.status].push(t.id)
  return cols
}

const isStatus = (id: string): id is Status => (STATUSES as string[]).includes(id)

/** The column an id lives in; a column id resolves to itself. */
export function findContainer(cols: Columns, id: string): Status | undefined {
  if (isStatus(id)) return id
  return STATUSES.find((s) => cols[s].includes(id))
}

export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** While dragging over another column: move the card there, before the card it hovers (or to the end). */
export function moveAcross(cols: Columns, activeId: string, overId: string): Columns {
  const from = findContainer(cols, activeId)
  const to = findContainer(cols, overId)
  if (!from || !to || from === to) return cols
  const fromList = cols[from].filter((id) => id !== activeId)
  const toList = [...cols[to]]
  const overIndex = overId === to ? toList.length : toList.indexOf(overId)
  toList.splice(overIndex < 0 ? toList.length : overIndex, 0, activeId)
  return { ...cols, [from]: fromList, [to]: toList }
}

/** On drop inside one column: put the card where the hovered card was. */
export function reorderWithin(cols: Columns, activeId: string, overId: string): Columns {
  const c = findContainer(cols, activeId)
  if (!c || overId === c || findContainer(cols, overId) !== c) return cols
  const list = cols[c]
  const from = list.indexOf(activeId)
  const to = list.indexOf(overId)
  if (from === to) return cols
  return { ...cols, [c]: arrayMove(list, from, to) }
}

/** An order value that sorts between two neighbours. */
export function orderBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return 1000
  if (prev === undefined) return (next as number) - 1000
  if (next === undefined) return prev + 1000
  return (prev + next) / 2
}

/** Where a dropped card ended up, and the order value that keeps it there. */
export function placement(cols: Columns, id: string, orderOf: (id: string) => number): { status: Status; order: number } | undefined {
  const status = findContainer(cols, id)
  if (!status) return undefined
  const list = cols[status]
  const i = list.indexOf(id)
  const prev = i > 0 ? orderOf(list[i - 1]) : undefined
  const next = i < list.length - 1 ? orderOf(list[i + 1]) : undefined
  return { status, order: orderBetween(prev, next) }
}
