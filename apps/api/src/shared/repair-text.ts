/**
 * Repairs "mojibake": UTF-8 text that some tagger stored as Windows-1252/Latin-1, so Persian "پادکست" shows up as "Ù¾Ø§Ø¯Ú©Ø³Øª".
 * The repair is applied only when the result is unambiguous: every character of the garbled text maps back to one byte,
 * those bytes form valid UTF-8, and the decoded text contains letters outside Latin-1.
 */

// Windows-1252 maps bytes 0x80–0x9F to these code points (the rest of 0x00–0xFF equals Latin-1).
const CP1252_SPECIALS: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

/** Lead bytes of multi-byte UTF-8 sequences, as they look when misread as Latin-1 (Ã, Â, Ø, Ù, Ú, Û, Ð, Ñ, å, ä, æ, ç, ...). */
const SUSPICIOUS = /[Â-ô]/

function toBytes(text: string): Uint8Array | null {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c < 0x100 && !(c >= 0x80 && c <= 0x9f)) out[i] = c
    else if (c >= 0x80 && c <= 0x9f) out[i] = c // control chars: some taggers keep the raw byte
    else {
      const b = CP1252_SPECIALS[c]
      if (b === undefined) return null
      out[i] = b
    }
  }
  return out
}

export function repairMojibake(text: string): string {
  if (!text || !SUSPICIOUS.test(text)) return text
  const bytes = toBytes(text)
  if (!bytes) return text
  let decoded: string
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return text }
  if (decoded === text || decoded.includes('�')) return text
  // Must contain real letters beyond Latin-1 (Arabic, Persian, Cyrillic, CJK, ...), otherwise it was probably genuine text.
  return /[Ā-￿]/.test(decoded) ? decoded : text
}
