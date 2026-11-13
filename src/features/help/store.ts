import { create } from 'zustand'

export type HelpTab = 'guide' | 'terms' | 'faq' | 'keys'
export const HELP_TABS: HelpTab[] = ['guide', 'terms', 'faq', 'keys']

/** Open state of the help centre, so any page can open it (optionally on a given tab). */
export const useHelp = create<{ open: boolean; tab: HelpTab; show: (tab?: HelpTab) => void; hide: () => void; setTab: (tab: HelpTab) => void }>()((set) => ({
  open: false,
  tab: 'guide',
  show: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
  hide: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
}))
