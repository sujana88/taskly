import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { addProject, createClient, formatRate, setClientArchived, updateClient, validateClient, type ClientInput } from './actions'

const input: ClientInput = {
  name: '  Tokyo Ramen ',
  color: '#BE185D',
  timezone: 'Asia/Tokyo',
  workHours: { start: '10:00', end: '18:00', days: [5, 1, 3, 1] },
  hourlyRate: 8000,
  currency: 'JPY',
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('client actions', () => {
  it('creates a client with a first project and tidy fields', async () => {
    const id = await createClient(input, 'General')
    const c = await db.clients.get(id)
    expect(c).toMatchObject({ name: 'Tokyo Ramen', archived: false, workHours: { days: [1, 3, 5] } })
    const projects = await db.projects.where('clientId').equals(id).toArray()
    expect(projects.map((p) => p.name)).toEqual(['General'])
  })

  it('updates, archives and restores', async () => {
    const id = await createClient(input)
    await updateClient(id, { ...input, name: 'Tokyo Ramen Co.' })
    await setClientArchived(id, true)
    expect(await db.clients.get(id)).toMatchObject({ name: 'Tokyo Ramen Co.', archived: true })
    await setClientArchived(id, false)
    expect((await db.clients.get(id))?.archived).toBe(false)
    expect(await addProject(id, '   ')).toBeUndefined()
    expect(await addProject(id, 'Menu app')).toBeTruthy()
  })

  it('validates the form', () => {
    expect(validateClient({ ...input, name: '', workHours: { start: '09:00', end: '09:00', days: [] }, hourlyRate: -1 })).toEqual({
      name: 'required',
      hours: 'sameTime',
      days: 'noDays',
      rate: 'negative',
    })
    expect(validateClient(input)).toEqual({})
  })

  it('formats rates per currency', () => {
    expect(formatRate(45, 'EUR', 'en')).toBe('€45')
    expect(formatRate(250000, 'IDR', 'id')).toMatch(/^Rp\s?250\.000$/)
  })
})
