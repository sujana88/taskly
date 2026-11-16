import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/Modal'
import type { Task } from '../../db/types'
import { formatMinutes } from '../../lib/time'
import { cancelTask } from './actions'

/** Asks before cancelling a task, because its logged time is removed for good. */
export function CancelTaskDialog({ task, minutes, onClose }: { task: Task | null; minutes: number; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal
      open={!!task}
      title={t('cancelled.confirmTitle', { title: task?.title ?? '' })}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="min-h-11 rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-slate-50">
            {t('cancelled.keep')}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (task) await cancelTask(task.id)
              onClose()
            }}
            className="min-h-11 rounded-[10px] bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
          >
            {t('cancelled.confirm')}
          </button>
        </>
      }
    >
      <p className="m-0 text-[15px] leading-relaxed text-slate-700" data-testid="cancel-confirm-body">
        {minutes > 0 ? t('cancelled.confirmBodyTime', { time: formatMinutes(minutes) }) : t('cancelled.confirmBody')}
      </p>
    </Modal>
  )
}
