import { describe, expect, test } from 'vitest'
import { buildCsp, isTrustedUrl, parseMediaUrl } from '../electron/main/policy'

describe('IPC sender trust', () => {
  test('accepts only the exact renderer origin', () => {
    expect(isTrustedUrl('mohhey-app://renderer/index.html', 'mohhey-app://renderer')).toBe(true)
    expect(isTrustedUrl('http://localhost:5173/#/songs', 'http://localhost:5173')).toBe(true)
    expect(isTrustedUrl('https://evil.example/', 'http://localhost:5173')).toBe(false)
    expect(isTrustedUrl('http://localhost:5173.evil.example/', 'http://localhost:5173')).toBe(false)
    expect(isTrustedUrl('mohhey-app://other/index.html', 'mohhey-app://renderer')).toBe(false)
    expect(isTrustedUrl(undefined, 'http://localhost:5173')).toBe(false)
    expect(isTrustedUrl('not a url', 'http://localhost:5173')).toBe(false)
  })
})

describe('media protocol parsing', () => {
  test('accepts numeric track ids and hashed artwork names', () => {
    expect(parseMediaUrl('mohhey-media://track/42')).toEqual({ kind: 'track', key: '42' })
    expect(parseMediaUrl(`mohhey-media://art/${'a'.repeat(40)}.jpg`)).toEqual({ kind: 'art', key: `${'a'.repeat(40)}.jpg` })
  })
  test('rejects paths, traversal and unknown hosts', () => {
    for (const bad of [
      'mohhey-media://track/../../etc/passwd', 'mohhey-media://track/C:/Windows/win.ini',
      'mohhey-media://art/../secret.jpg', 'mohhey-media://art/abc.jpg', 'mohhey-media://file/42', 'garbage',
    ]) expect(parseMediaUrl(bad)).toBeNull()
  })
})

describe('CSP', () => {
  test('production forbids inline scripts and remote origins', () => {
    const csp = buildCsp(false, 'mohhey-media')
    expect(csp).toContain("script-src 'self';")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toMatch(/https?:\/\/(?!127\.0\.0\.1)/)
    expect(csp).toContain("object-src 'none'")
  })
  test('dev allows HMR websocket only in dev', () => {
    expect(buildCsp(true, 'mohhey-media')).toContain('ws://localhost:*')
    expect(buildCsp(false, 'mohhey-media')).not.toContain('ws://')
  })
})

describe('packaged-build switch guard', () => {
  test('refuses switches that expose or weaken the app', async () => {
    const { findForbiddenSwitch } = await import('../electron/main/policy')
    for (const bad of [
      '--remote-debugging-port=9222', '--remote-debugging-pipe', '--remote-allow-origins=*', '--inspect', '--inspect-brk=9229', '--js-flags=--expose-gc',
      '--load-extension=C:/x', '--disable-web-security', '--no-sandbox', '--proxy-server=evil:80', '--ignore-certificate-errors', '--host-rules=MAP * evil',
    ]) expect(findForbiddenSwitch(['app.exe', bad]), bad).toBe(bad)
    for (const ok of ['--user-data-dir=C:/data', '--lang=fa', '--enable-logging', '--force-device-scale-factor=1.5']) expect(findForbiddenSwitch([ok]), ok).toBeNull()
  })

  test('CSP forbids framing, forms, workers and plugins', () => {
    const csp = buildCsp(false, 'mohhey-media')
    for (const d of ["form-action 'none'", "frame-src 'none'", "worker-src 'none'", "object-src 'none'", "base-uri 'none'"]) expect(csp).toContain(d)
  })
})
