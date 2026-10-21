import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { migrateLegacyUserData } from '../electron/main/userdata'

let root: string
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'mohhey-ud-')) })
afterEach(() => rmSync(root, { recursive: true, force: true }))

const seed = (dir: string, db: string) => {
  mkdirSync(join(dir, 'data', 'artwork'), { recursive: true })
  writeFileSync(join(dir, 'data', 'library.db'), db)
  writeFileSync(join(dir, 'data', 'artwork', 'a.jpg'), 'img')
  writeFileSync(join(dir, 'window-state.json'), '{}')
}

test('copies the old library once and keeps the old folder as a backup', () => {
  const legacy = join(root, 'legacy'), current = join(root, 'current')
  seed(legacy, 'OLD')
  expect(migrateLegacyUserData(legacy, current)).toBe(true)
  expect(readFileSync(join(current, 'data', 'library.db'), 'utf8')).toBe('OLD')
  expect(existsSync(join(current, 'data', 'artwork', 'a.jpg'))).toBe(true)
  expect(existsSync(join(current, 'window-state.json'))).toBe(true)
  expect(existsSync(join(legacy, 'data', 'library.db'))).toBe(true)
})

test('never overwrites an existing library, and does nothing without a legacy one', () => {
  const legacy = join(root, 'legacy'), current = join(root, 'current')
  seed(legacy, 'OLD'); seed(current, 'NEW')
  expect(migrateLegacyUserData(legacy, current)).toBe(false)
  expect(readFileSync(join(current, 'data', 'library.db'), 'utf8')).toBe('NEW')
  expect(migrateLegacyUserData(join(root, 'nothing'), join(root, 'other'))).toBe(false)
})
