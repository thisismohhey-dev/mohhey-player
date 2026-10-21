const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/**
 * Normalises text for search: lower-case, strips diacritics and Arabic/Persian
 * tashkeel, unifies Arabic/Persian letter variants and digits, collapses spaces.
 */
export function normalizeText(input: string): string {
  let out = input.normalize('NFKD').toLowerCase()
  out = out.replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640\u200c\u200d]/g, (m) => (m === '\u200c' ? ' ' : ''))
  out = out
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ۀ|ة/g, 'ه')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
  return out.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function escapeLike(s: string): string {
  return s.replace(/[\%_]/g, (c) => `\${c}`)
}
