import type { TFunction } from 'i18next'
import type { Client, Task } from '../../db/types'
import { formatSpan } from '../../lib/overlap'
import type { WeekReport } from '../../lib/report'
import { formatInZone } from '../../lib/time'

/**
 * A short async status update for one client, written from this week's data:
 * what got done, what is in progress (with steps and deadline), what comes next, and time logged.
 */
export function buildProgressUpdate(args: { t: TFunction; lang: string; tz: string; client: Client; tasks: Task[]; report: WeekReport; clientOf: (t: Task) => Client | undefined; sender?: string }): string {
  const { t, lang, tz, client, report, sender } = args
  const mine = args.tasks.filter((x) => args.clientOf(x)?.id === client.id)
  const done = report.tasksDone.filter((x) => args.clientOf(x)?.id === client.id)
  const active = mine.filter((x) => x.status === 'in_progress' || x.status === 'in_revision').sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
  const ms = report.clients.find((c) => c.client.id === client.id)?.ms ?? 0

  const lines: string[] = [t('reports.update.hi', { name: client.contactName?.trim() || t('reports.update.team', { client: client.name }) }), '']

  if (done.length) lines.push(t('reports.update.done', { count: done.length, titles: done.map((x) => x.title).join(', ') }))

  for (const x of active.slice(0, 2)) {
    const steps = x.subtasks.length ? t('reports.update.steps', { done: x.subtasks.filter((s) => s.done).length, total: x.subtasks.length }) : ''
    const due = x.dueAt ? t('reports.update.due', { date: formatInZone(x.dueAt, tz, lang, 'EEE d MMM, HH:mm') }) : ''
    lines.push(t(x.status === 'in_revision' ? 'reports.update.revising' : 'reports.update.progress', { title: x.title }) + steps + due)
  }

  const nextStep = active.flatMap((x) => x.subtasks.filter((s) => !s.done).map((s) => ({ s, x })))[0]
  const nextTodo = mine.filter((x) => x.status === 'todo').sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))[0]
  if (nextStep) lines.push(t('reports.update.nextStep', { step: nextStep.s.title.toLowerCase(), title: nextStep.x.title }))
  else if (nextTodo) lines.push(t('reports.update.nextTask', { title: nextTodo.title }))

  if (!done.length && !active.length && !nextTodo) lines.push(t('reports.update.quiet'))

  lines.push('', t('reports.update.logged', { time: formatSpan(ms) }))
  if (sender) lines.push('', t('reports.update.thanks'), sender)
  return lines.join('\n')
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A clean, printable timesheet in a new tab; the browser's "Save as PDF" makes the file. */
export function printTimesheet(args: { title: string; subtitle: string; head: string[]; rows: string[][]; total: string[]; note: string }): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  const row = (cells: string[], tag = 'td') => `<tr>${cells.map((c, i) => `<${tag}${i ? ' class="n"' : ''}>${esc(c)}</${tag}>`).join('')}</tr>`
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(args.title)}</title>
<style>
  body{font:14px/1.5 "Plus Jakarta Sans",system-ui,sans-serif;color:#0f172a;margin:48px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;color:#2563eb}
  .brand i{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:inline-block}
  h1{font-size:26px;margin:28px 0 4px} p{color:#64748b;margin:0}
  table{width:100%;border-collapse:collapse;margin-top:28px} th,td{padding:10px 12px;border-bottom:1px solid #e5e9f2;text-align:left}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b} .n{text-align:right;font-variant-numeric:tabular-nums}
  tfoot td{font-weight:700;border-bottom:0;border-top:2px solid #0f172a} .note{margin-top:24px;font-size:12px}
  @media print{body{margin:24px}}
</style></head><body>
<div class="brand"><i></i>Taskly</div>
<h1>${esc(args.title)}</h1><p>${esc(args.subtitle)}</p>
<table><thead>${row(args.head, 'th')}</thead><tbody>${args.rows.map((r) => row(r)).join('')}</tbody><tfoot>${row(args.total)}</tfoot></table>
<p class="note">${esc(args.note)}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`)
  w.document.close()
  return true
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  // BOM so spreadsheet apps read UTF-8 names (e.g. "Rp", "€") correctly.
  const blob = new Blob(['﻿', text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
