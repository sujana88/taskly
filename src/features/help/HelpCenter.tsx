import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { Icon } from '../../components/Icon'
import { GUIDE_ICON, GUIDE_ORDER, GUIDE_ROUTE, guideForPath, helpContent, searchHelp, type HelpHit } from './content'
import { HELP_TABS, useHelp, type HelpTab } from './store'

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null
  return !!n && (n.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(n.tagName))
}

/** The floating "? Help" button plus the help panel. Mounted once for signed-in pages. */
export function HelpCenter() {
  const { t } = useTranslation()
  const { open, show } = useHelp()

  // "?" opens help from anywhere, unless the user is typing.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show])

  return (
    <>
      <button
        type="button"
        onClick={() => show()}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="?"
        title={t('help.buttonTitle')}
        data-testid="help-button"
        className="fixed right-4 bottom-24 z-40 flex min-h-12 items-center gap-2 rounded-full bg-ink py-2 pr-5 pl-2.5 text-[15px] font-bold text-white shadow-[0_12px_28px_-10px_rgba(15,23,42,0.7)] ring-1 ring-white/10 transition-transform hover:-translate-y-0.5 hover:bg-slate-800 md:right-6 md:bottom-6"
      >
        <Icon name="help" size={24} strokeWidth={2.2} />
        {t('help.button')}
      </button>
      <HelpPanel />
    </>
  )
}

function HelpPanel() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'id' ? 'id' : 'en'
  const c = helpContent[lang]
  const { open, tab, hide, setTab } = useHelp()
  const ref = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const location = useLocation()
  const current = guideForPath(location.pathname)
  const tabsId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      searchRef.current?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  const hits = useMemo(() => searchHelp(c, query), [c, query])
  const searching = query.trim().length > 0

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = HELP_TABS.indexOf(tab)
    const next = e.key === 'ArrowRight' ? HELP_TABS[(i + 1) % HELP_TABS.length] : e.key === 'ArrowLeft' ? HELP_TABS[(i + HELP_TABS.length - 1) % HELP_TABS.length] : null
    if (!next) return
    e.preventDefault()
    setTab(next)
    document.getElementById(`${tabsId}-${next}`)?.focus()
  }

  return (
    <dialog
      ref={ref}
      onClose={hide}
      onClick={(e) => {
        if (e.target === ref.current) hide()
      }}
      aria-labelledby="help-title"
      data-testid="help-panel"
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-[520px] border-l border-line bg-canvas p-0 text-ink shadow-2xl backdrop:bg-slate-900/35"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="brand-surface relative overflow-hidden px-6 pt-6 pb-5">
            <div className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-white/20">
                  <Icon name="help" size={24} />
                </span>
                <div>
                  <h2 id="help-title" className="m-0 text-xl font-extrabold tracking-tight">
                    {c.title}
                  </h2>
                  <p className="m-0 text-[13px] text-blue-100">{c.intro}</p>
                </div>
              </div>
              <button type="button" onClick={hide} aria-label={t('help.close')} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/15">
                <Icon name="close" size={18} />
              </button>
            </div>
            <label className="relative mt-4 flex items-center gap-2 rounded-2xl bg-white px-3.5 text-ink shadow-sm focus-within:ring-4 focus-within:ring-white/40">
              <Icon name="search" size={18} className="text-slate-400" />
              <span className="sr-only">{t('help.search')}</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Esc first clears the search, then closes help.
                  if (e.key !== 'Escape') return
                  e.preventDefault()
                  if (query) setQuery('')
                  else hide()
                }}
                placeholder={t('help.searchPlaceholder')}
                className="min-h-12 w-full border-none bg-transparent text-[15px] outline-none placeholder:text-slate-400 focus-visible:outline-none"
              />
            </label>
          </header>

          {searching ? (
            <div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
              <p className="m-0 mb-3 text-[13px] font-semibold text-muted" data-testid="help-result-count">
                {t('help.results', { count: hits.length, query: query.trim() })}
              </p>
              {hits.length ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {hits.map((h, i) => (
                    <SearchHit key={i} hit={h} onGo={hide} />
                  ))}
                </ul>
              ) : (
                <div className="card flex flex-col items-center gap-2 p-6 text-center">
                  <span className="text-sm font-semibold">{t('help.noResults')}</span>
                  <button type="button" onClick={() => setQuery('')} className="min-h-10 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-slate-50">
                    {t('help.clearSearch')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div role="tablist" aria-label={t('help.sections')} className="mx-5 mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-line">
                {HELP_TABS.map((k) => (
                  <button
                    key={k}
                    id={`${tabsId}-${k}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === k}
                    aria-controls={`${tabsId}-panel`}
                    tabIndex={tab === k ? 0 : -1}
                    onClick={() => setTab(k)}
                    onKeyDown={onTabKey}
                    className={`min-h-10 rounded-xl px-1 text-[13px] font-bold transition-colors ${tab === k ? 'bg-accent text-white shadow-sm' : 'text-slate-500 hover:text-ink'}`}
                  >
                    {t(`help.tab.${k}`)}
                  </button>
                ))}
              </div>
              <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                <TabBody tab={tab} current={current} onGo={hide} />
              </div>
            </>
          )}

          <footer className="flex items-center justify-between gap-3 border-t border-line bg-white px-5 py-3 text-xs text-muted">
            <span>{t('help.footer')}</span>
            <kbd className="rounded-md border border-line bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-bold text-slate-600">?</kbd>
          </footer>
        </div>
      )}
    </dialog>
  )
}

function TabBody({ tab, current, onGo }: { tab: HelpTab; current: ReturnType<typeof guideForPath>; onGo: () => void }) {
  const { t, i18n } = useTranslation()
  const c = helpContent[i18n.resolvedLanguage === 'id' ? 'id' : 'en']

  if (tab === 'guide')
    return (
      <div className="flex flex-col gap-6">
        <section aria-labelledby="qs-h" className="card p-5">
          <h3 id="qs-h" className="m-0 mb-4 flex items-center gap-2 text-[15px] font-extrabold">
            <AppIcon name="fire" size={20} />
            {c.quickStart.title}
          </h3>
          <ol className="m-0 flex list-none flex-col gap-4 p-0" data-testid="quick-start">
            {c.quickStart.steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-white">{i + 1}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{s.title}</span>
                  <span className="text-[13px] leading-relaxed text-slate-600">{s.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="pages-h" className="flex flex-col gap-2.5">
          <h3 id="pages-h" className="m-0 text-[13px] font-bold tracking-wide text-slate-500 uppercase">
            {t('help.byPage')}
          </h3>
          {GUIDE_ORDER.map((g) => {
            const guide = c.guides[g]
            return (
              <details key={g} open={g === current} className="group card overflow-hidden" data-testid={`guide-${g}`}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-50">
                    <AppIcon name={GUIDE_ICON[g]} size={22} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {guide.title}
                      {g === current && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-strong">{t('help.thisPage')}</span>}
                    </span>
                    <span className="truncate text-xs text-muted">{guide.summary}</span>
                  </span>
                  <Icon name="chevronRight" size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="flex flex-col gap-3 border-t border-line px-4 pt-3 pb-4">
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {guide.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
                        <Icon name="check" size={15} strokeWidth={2.6} className="mt-0.5 shrink-0 text-accent" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {g !== current && (
                    <Link to={GUIDE_ROUTE[g]} onClick={onGo} className="flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-accent-soft px-3.5 text-[13px] font-bold text-accent-strong no-underline hover:bg-blue-100">
                      {t('help.openPage', { page: guide.title })}
                      <Icon name="chevronRight" size={14} />
                    </Link>
                  )}
                </div>
              </details>
            )
          })}
        </section>
      </div>
    )

  if (tab === 'terms')
    return (
      <dl className="m-0 flex flex-col gap-2" data-testid="glossary">
        {c.glossary.map((x) => (
          <div key={x.term} className="card px-4 py-3">
            <dt className="text-sm font-bold text-accent-strong">{x.term}</dt>
            <dd className="m-0 mt-0.5 text-[13px] leading-relaxed text-slate-700">{x.meaning}</dd>
          </div>
        ))}
      </dl>
    )

  if (tab === 'faq')
    return (
      <div className="flex flex-col gap-2" data-testid="faq">
        {c.faq.map((x) => (
          <details key={x.q} className="group card overflow-hidden">
            <summary className="flex min-h-13 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[13px] font-extrabold text-accent">?</span>
              <span className="flex-1">{x.q}</span>
              <Icon name="chevronRight" size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <p className="m-0 border-t border-line px-4 py-3 pl-14 text-[13px] leading-relaxed text-slate-700">{x.a}</p>
          </details>
        ))}
      </div>
    )

  return (
    <ul className="card m-0 flex list-none flex-col p-0" data-testid="shortcuts">
      {c.shortcuts.map((s, i) => (
        <li key={s.action} className={`flex items-center justify-between gap-4 px-4 py-3 text-[13px] ${i ? 'border-t border-line' : ''}`}>
          <span className="text-slate-700">{s.action}</span>
          <span className="flex shrink-0 gap-1">
            {s.keys.map((k) => (
              <kbd key={k} className="min-w-7 rounded-lg border border-b-2 border-line bg-white px-2 py-1 text-center font-sans text-xs font-bold text-ink">
                {k}
              </kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SearchHit({ hit, onGo }: { hit: HelpHit; onGo: () => void }) {
  const { t } = useTranslation()
  const kind = t(`help.kind.${hit.kind}`)
  return (
    <li className="card flex flex-col gap-1 px-4 py-3" data-testid="help-hit">
      <span className="text-[11px] font-bold tracking-wide text-accent uppercase">{kind}</span>
      <span className="text-sm font-bold">{hit.title}</span>
      <span className="text-[13px] leading-relaxed text-slate-700">{hit.text}</span>
      {hit.kind === 'guide' && (
        <Link to={GUIDE_ROUTE[hit.guide]} onClick={onGo} className="mt-1 self-start text-[13px] font-bold text-accent no-underline hover:underline">
          {t('help.openPage', { page: hit.title })} →
        </Link>
      )}
    </li>
  )
}
