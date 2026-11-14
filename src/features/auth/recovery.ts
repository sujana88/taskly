import { create } from 'zustand'

/**
 * State of a password reset that arrived by email link:
 * - active: the user came from a valid reset link and should choose a new password now;
 * - linkError: the link was expired or already used (e.g. "otp_expired").
 */
export const useRecovery = create<{ active: boolean; linkError: string | null; set: (s: Partial<{ active: boolean; linkError: string | null }>) => void }>()((set) => ({
  active: false,
  linkError: null,
  set: (s) => set(s),
}))
