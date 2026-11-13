import { useTranslation } from 'react-i18next'
import type { Interval } from '../../lib/overlap'
import { formatSpan } from '../../lib/overlap'
import { niceHoursMax } from '../../lib/report'
import { formatInZone } from '../../lib/time'

/**
 * Hours per day as one series: the busiest day in the brand blue, the rest in a light step of
 * the same hue (magnitude, not identity). Each bar shows a tooltip on hover and keyboard focus;
 * values under the bars keep it readable without hovering.
 */
export function WeekBars({ days, tz, compact = false, today }: { days: { day: Interval; ms: number }[]; tz: string; compact?: boolean; today?: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const max = Math.max(...days.map((d) => d.ms), 0)
  const top = niceHoursMax(max)
  const peak = max > 0 ? days.findIndex((d) => d.ms === max) : -1
  const height = compact ? 'h-28' : 'h-52'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!compact && (
          <div className={`relative w-7 shrink-0 text-[11px] text-muted tabular-nums ${height}`} aria-hidden="true">
            <span className="absolute -top-1.5 right-0">{top}h</span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">{top / 2}h</span>
            <span className="absolute right-0 -bottom-1.5">0</span>
          </div>
        )}
        <div className={`relative flex-1 ${height}`}>
          {/* Recessive gridlines */}
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" aria-hidden="true" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 border-t border-slate-300" aria-hidden="true" />
          <ul className="absolute inset-0 m-0 flex list-none items-end gap-1.5 p-0 sm:gap-3" aria-label={t('reports.chartLabel')}>
            {days.map((d, i) => {
              const label = `${formatInZone(d.day.start, tz, lang, 'EEEE d MMM')}: ${formatSpan(d.ms)}`
              const isToday = today !== undefined && today >= d.day.start && today < d.day.end
              return (
                <li key={d.day.start} className="group relative flex h-full flex-1 items-end justify-center">
                  <div
                    tabIndex={0}
                    role="img"
                    aria-label={label}
                    data-testid="day-bar"
                    className={`w-full max-w-14 rounded-t-[6px] outline-offset-2 transition-[height,background-color] duration-500 ${
                      i === peak ? 'bg-accent' : isToday ? 'bg-blue-300' : 'bg-blue-200 group-hover:bg-blue-300'
                    }`}
                    style={{ height: d.ms ? `max(4px, ${(d.ms / (top * 36e5)) * 100}%)` : '0' }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    {label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <div className={`flex gap-1.5 sm:gap-3 ${compact ? '' : 'pl-9'}`} aria-hidden="true">
        {days.map((d, i) => (
          <div key={d.day.start} className="flex flex-1 flex-col items-center leading-tight">
            <span className={`text-[11px] ${i === peak ? 'font-bold text-accent' : 'text-muted'}`}>{formatInZone(d.day.start, tz, lang, compact ? 'EEEEE' : 'EEE')}</span>
            {!compact && <span className="text-xs font-semibold tabular-nums">{formatSpan(d.ms)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
