// Sends the "Welcome to Taskly" email through Resend, once per account.
//
// Called by the database (trigger on public.profiles, see the welcome_email migration) with
// { "user_id": "…" }. It needs no caller secret: it only ever writes to the account's own,
// verified address, and only once (profiles.welcome_sent_at is claimed before sending).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY  required — the Resend API key
//   RESEND_FROM     optional — e.g. "Taskly <hello@yourdomain.com>" (a domain verified in Resend).
//                   Without it, Resend's test sender is used, which only delivers to the Resend
//                   account owner's own address.
//   APP_URL         optional — link in the email (defaults to the live app)
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://taskly-app.time16.workers.dev'
const FROM = Deno.env.get('RESEND_FROM') ?? 'Taskly <onboarding@resend.dev>'

type Lang = 'en' | 'id'

const copy = {
  en: {
    subject: (name: string) => `Welcome to Taskly${name ? `, ${name}` : ''}!`,
    hello: (name: string) => `Hi${name ? ` ${name}` : ''},`,
    intro: 'Thanks for signing up. Taskly keeps your tasks, focus time and clients in one place, and always shows what time it is for each client.',
    stepsTitle: 'Get started in three steps',
    steps: [
      ['Add your clients', 'with their time zone, working hours and hourly rate. Taskly shows when you overlap.'],
      ['Plan and track your work', 'on the Kanban board, with the Standard timer or Pomodoro focus sessions.'],
      ['Bill your clients', 'with an invoice made from your tracked time, as a PDF or straight to WhatsApp.'],
    ],
    cta: 'Open Taskly',
    help: 'Questions? Press the Help button in the app any time.',
    signoff: 'Happy working,\nThe Taskly team',
    why: 'You receive this email because an account was created with this address on Taskly.',
  },
  id: {
    subject: (name: string) => `Selamat datang di Taskly${name ? `, ${name}` : ''}!`,
    hello: (name: string) => `Halo${name ? ` ${name}` : ''},`,
    intro: 'Terima kasih sudah mendaftar. Taskly menyatukan tugas, waktu fokus dan klien Anda di satu tempat, dan selalu menunjukkan jam berapa di tempat setiap klien.',
    stepsTitle: 'Mulai dalam tiga langkah',
    steps: [
      ['Tambahkan klien Anda', 'lengkap dengan zona waktu, jam kerja dan tarif per jam. Taskly menunjukkan kapan jam kerja Anda bertemu.'],
      ['Rencanakan dan catat pekerjaan', 'di papan Kanban, dengan timer Standar atau sesi fokus Pomodoro.'],
      ['Tagih klien Anda', 'dengan invoice dari waktu kerja yang tercatat, sebagai PDF atau langsung lewat WhatsApp.'],
    ],
    cta: 'Buka Taskly',
    help: 'Ada pertanyaan? Tekan tombol Bantuan di aplikasi kapan saja.',
    signoff: 'Selamat bekerja,\nTim Taskly',
    why: 'Anda menerima email ini karena sebuah akun dibuat dengan alamat ini di Taskly.',
  },
} as const

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function render(lang: Lang, name: string) {
  const c = copy[lang]
  const steps = c.steps
    .map(
      ([title, body], i) => `
        <tr>
          <td style="padding:0 0 14px 0;vertical-align:top;width:36px">
            <div style="width:28px;height:28px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:14px;line-height:28px;text-align:center">${i + 1}</div>
          </td>
          <td style="padding:0 0 14px 0;font-size:15px;line-height:1.55;color:#334155"><strong style="color:#0f172a">${esc(title)}</strong> ${esc(body)}</td>
        </tr>`,
    )
    .join('')
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject(name))}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);background-color:#2563eb;padding:28px 32px;color:#ffffff">
          <div style="font-size:22px;font-weight:800;letter-spacing:-0.01em">Taskly</div>
          <div style="margin-top:6px;font-size:14px;opacity:.9">${lang === 'id' ? 'Tugas, fokus dan klien di satu tempat' : 'Tasks, focus and clients in one place'}</div>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a">${esc(c.hello(name))}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155">${esc(c.intro)}</p>
          <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">${esc(c.stepsTitle)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${steps}</table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 24px"><tr><td style="border-radius:12px;background:#2563eb">
            <a href="${APP_URL}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${esc(c.cta)}</a>
          </td></tr></table>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">${esc(c.help)}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-line">${esc(c.signoff)}</p>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#94a3b8">${esc(c.why)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  const text = [
    c.hello(name),
    '',
    c.intro,
    '',
    c.stepsTitle,
    ...c.steps.map(([t, b], i) => `${i + 1}. ${t} ${b}`),
    '',
    `${c.cta}: ${APP_URL}`,
    '',
    c.help,
    '',
    c.signoff,
  ].join('\n')
  return { subject: c.subject(name), html, text }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return json(500, { error: 'RESEND_API_KEY is not set' })

  let userId: string | undefined
  try {
    userId = (await req.json())?.user_id
  } catch {
    // fall through
  }
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { error: 'user_id required' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // Claim the send first: only one call per account gets past this.
  const { data: claimed, error: claimError } = await admin
    .from('profiles')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_sent_at', null)
    .select('name, language')
    .maybeSingle()
  if (claimError) return json(500, { error: claimError.message })
  if (!claimed) return json(200, { skipped: 'already sent or no profile' })

  const { data: user, error: userError } = await admin.auth.admin.getUserById(userId)
  const email = user?.user?.email
  if (userError || !email) {
    await admin.from('profiles').update({ welcome_sent_at: null }).eq('id', userId)
    return json(404, { error: 'user not found' })
  }

  const lang: Lang = claimed.language === 'id' ? 'id' : 'en'
  const name = String(claimed.name ?? '').trim().split(/\s+/)[0] ?? ''
  const { subject, html, text } = render(lang, name)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `welcome-${userId}` },
    body: JSON.stringify({ from: FROM, to: [email], subject, html, text, tags: [{ name: 'type', value: 'welcome' }] }),
  })
  if (!res.ok) {
    // Let a later call try again.
    await admin.from('profiles').update({ welcome_sent_at: null }).eq('id', userId)
    const detail = await res.text()
    console.error('[send-welcome] resend failed', res.status, detail)
    return json(502, { error: 'resend failed', status: res.status })
  }
  const sent = await res.json()
  return json(200, { sent: true, id: sent?.id })
})
