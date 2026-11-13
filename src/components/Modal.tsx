import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

/** Centered modal on the native <dialog>: focus trap, Esc to close and backdrop come for free. */
export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { t } = useTranslation()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby={titleId}
      className={`m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] ${wide ? 'max-w-2xl' : 'max-w-md'} card p-0 text-ink shadow-2xl backdrop:bg-slate-900/40`}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-32px)] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
            <h2 id={titleId} className="m-0 text-lg font-semibold">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label={t('drawer.close')} className="flex size-10 items-center justify-center rounded-[10px] text-slate-600 hover:bg-slate-100">
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
