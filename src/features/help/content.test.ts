import { describe, expect, it } from 'vitest'
import { GUIDE_ORDER, guideForPath, helpContent, searchHelp } from './content'

const { en, id } = helpContent

describe('help content', () => {
  it('has the same structure in English and Indonesian', () => {
    expect(id.quickStart.steps).toHaveLength(en.quickStart.steps.length)
    for (const g of GUIDE_ORDER) expect(id.guides[g].points).toHaveLength(en.guides[g].points.length)
    expect(id.glossary).toHaveLength(en.glossary.length)
    expect(id.faq).toHaveLength(en.faq.length)
    expect(id.shortcuts.map((s) => s.keys.length)).toEqual(en.shortcuts.map((s) => s.keys.length))
  })

  it('opens the guide for the page you are on', () => {
    expect(['/', '/tasks', '/focus', '/clients', '/reports', '/anything'].map(guideForPath)).toEqual(['dashboard', 'tasks', 'focus', 'clients', 'reports', 'dashboard'])
  })

  it('searches every section, all words, ignoring case and accents', () => {
    expect(searchHelp(en, '   ')).toEqual([])
    expect(searchHelp(en, 'OVERLAP').map((h) => h.kind)).toContain('term')
    expect(searchHelp(en, 'pdf pop-ups').map((h) => h.title)).toEqual(['How do I save a timesheet as PDF?'])
    expect(searchHelp(id, 'email spam').some((h) => h.kind === 'faq')).toBe(true)
    expect(searchHelp(en, 'zzzz')).toEqual([])
  })
})
