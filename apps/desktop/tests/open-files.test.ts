import { expect, test } from 'vitest'
import { audioPathsFromArgv } from '../electron/main/open-files'

test('keeps absolute audio paths, drops flags, relative paths, other types and duplicates', () => {
  const argv = ['C:/Program Files/M. Player/M. Player.exe', '--inspect', 'C:/Music/a.MP3', 'C:/Music/a.MP3', 'rel/b.mp3', 'C:/Music/doc.txt', 'D:/x/c.flac', '--x=C:/y.mp3']
  expect(audioPathsFromArgv(argv)).toEqual(['C:/Music/a.MP3', 'D:/x/c.flac'])
})

test('is capped', () => {
  const many = Array.from({ length: 500 }, (_, i) => `C:/m/${i}.mp3`)
  expect(audioPathsFromArgv(many).length).toBe(200)
})
