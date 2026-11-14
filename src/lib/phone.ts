/**
 * Phone numbers are stored as one string, "+62 812 3456 7890": the country's dialling code,
 * a space, then the local number. The form edits the two parts separately.
 */

/** Countries offered in the picker: ISO code → dialling code. */
export const COUNTRY_DIAL: Record<string, string> = {
  ID: '+62', MY: '+60', SG: '+65', TH: '+66', PH: '+63', VN: '+84', AU: '+61', NZ: '+64', JP: '+81', KR: '+82',
  CN: '+86', HK: '+852', TW: '+886', IN: '+91', PK: '+92', BD: '+880', AE: '+971', SA: '+966', TR: '+90', GB: '+44',
  IE: '+353', DE: '+49', FR: '+33', NL: '+31', BE: '+32', ES: '+34', IT: '+39', PT: '+351', CH: '+41', AT: '+43',
  SE: '+46', NO: '+47', DK: '+45', FI: '+358', PL: '+48', US: '+1', CA: '+1', MX: '+52', BR: '+55', AR: '+54',
  ZA: '+27', NG: '+234', EG: '+20',
}

/** Time zone → country, to suggest a dialling code from the client's zone. */
const ZONE_COUNTRY: Record<string, string> = {
  'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Pontianak': 'ID',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH', 'Asia/Manila': 'PH',
  'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN', 'Pacific/Auckland': 'NZ', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Europe/Istanbul': 'TR',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT', 'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA',
  'America/Halifax': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR',
  'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Cairo': 'EG',
}

/** Country suggested for a time zone; Indonesia when the zone isn't known. */
export function countryForZone(tz: string, fallback = 'ID'): string {
  if (ZONE_COUNTRY[tz]) return ZONE_COUNTRY[tz]
  if (tz.startsWith('Australia/')) return 'AU'
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)$/.test(tz) || tz === 'Pacific/Honolulu') return 'US'
  return fallback
}

/** Countries for the picker, sorted by their name in `lang`. */
export function countryOptions(lang: string): { iso: string; dial: string; name: string }[] {
  let names: Intl.DisplayNames | undefined
  try {
    names = new Intl.DisplayNames([lang === 'id' ? 'id' : 'en'], { type: 'region' })
  } catch {
    names = undefined
  }
  return Object.entries(COUNTRY_DIAL)
    .map(([iso, dial]) => ({ iso, dial, name: names?.of(iso) ?? iso }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Splits a stored number into country and local part. A number without "+" keeps the
 * suggested country. When two countries share a code (+1), the suggested one wins.
 */
export function splitPhone(value: string | undefined, suggested: string): { country: string; local: string } {
  const v = (value ?? '').trim()
  if (!v.startsWith('+')) return { country: suggested, local: v }
  const digits = v.replace(/[^\d+]/g, '')
  let best: string | undefined
  for (const [iso, dial] of Object.entries(COUNTRY_DIAL)) {
    if (!digits.startsWith(dial)) continue
    const better = !best || dial.length > COUNTRY_DIAL[best].length || (dial === COUNTRY_DIAL[best] && iso === suggested)
    if (better) best = iso
  }
  if (!best) return { country: suggested, local: v }
  // Drop the code itself (written with or without spaces) from the front.
  let rest = v.slice(1)
  for (const ch of COUNTRY_DIAL[best].slice(1)) rest = rest.replace(new RegExp(`^[\\s-]*${ch}`), '')
  return { country: best, local: rest.replace(/^[\s-]+/, '') }
}

/** "+62" + "0812 3456 7890" → "+62 812 3456 7890". Empty local number → "". */
export function joinPhone(country: string, local: string): string {
  const l = local.trim()
  if (!l) return ''
  if (l.startsWith('+')) return l
  // The national trunk "0" is dropped after a country code (Italy keeps it).
  const national = country === 'IT' ? l : l.replace(/^0+(?=\d)/, '')
  return `${COUNTRY_DIAL[country] ?? ''} ${national}`.trim()
}
