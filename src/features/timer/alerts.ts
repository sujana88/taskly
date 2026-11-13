/** A short three-note chime made with Web Audio, so there is no sound file to ship. */
export function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notes = [660, 880, 990]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.18
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    // Audio blocked or unavailable; the on-screen message still shows.
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notify(title: string, body: string): void {
  try {
    if (notificationsSupported() && Notification.permission === 'granted') new Notification(title, { body, icon: './favicon.svg', tag: 'overlap-pomodoro' })
  } catch {
    // Some browsers only allow notifications from a service worker; ignore.
  }
}
