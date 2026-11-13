import { describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { buildSampleEntries, buildSampleTasks, sampleClients, sampleProjects } from '../../db/seed'
import type { Task } from '../../db/types'
import { buildWeekReport } from '../../lib/report'
import { buildProgressUpdate } from './update'

const NOW = Date.parse('2026-11-12T09:02:00Z')
const tasks = buildSampleTasks(NOW)
const projectsById = new Map(sampleProjects.map((p) => [p.id, p]))
const clientsById = new Map(sampleClients.map((c) => [c.id, c]))
const clientOf = (t: Task) => clientsById.get(projectsById.get(t.projectId)!.clientId)
const report = buildWeekReport({ entries: buildSampleEntries(NOW), tasks, projectsById, clientsById, tz: 'Asia/Jakarta', now: NOW })

const update = async (lang: string, clientId: string, sender?: string) => {
  await i18n.changeLanguage(lang)
  return buildProgressUpdate({ t: i18n.t, lang, tz: 'Asia/Jakarta', client: clientsById.get(clientId)!, tasks, report, clientOf, sender })
}

describe('progress update', () => {
  it('writes done, in progress, next and time logged for the client', async () => {
    expect(await update('en', 'c-nord', 'Demo Freelancer')).toBe(
      [
        "Hi Lena, here is this week's update.",
        '',
        'In progress: Hero section redesign, 3 of 5 steps done. On track for Fri 13 Nov, 23:00 (my time).',
        'In revision: Pricing page v2, 4 of 5 steps done. On track for Mon 16 Nov, 23:00 (my time).',
        'Next: high-fidelity desktop version for Hero section redesign.',
        '',
        'Time logged this week: 9h 15m.',
        '',
        'Best regards,',
        'Demo Freelancer',
      ].join('\n'),
    )
  })

  it('reports finished work and speaks Indonesian', async () => {
    const text = await update('id', 'c-pine')
    expect(text).toContain('Halo Jordan, berikut update minggu ini.')
    expect(text).toContain('Selesai: Design system audit siap untuk Anda review.')
    expect(text).toContain('Berikutnya: Landing page wireframes.')
    expect(text).toContain('Waktu tercatat minggu ini: 8h 15m.')
    await i18n.changeLanguage('en')
  })

  it('greets the team when there is no contact name', async () => {
    clientsById.set('c-harb', { ...clientsById.get('c-harb')!, contactName: '' })
    expect((await update('en', 'c-harb')).split('\n')[0]).toBe("Hi Harbour Digital team, here is this week's update.")
  })
})
