// Sets one version number everywhere (root, apps, packages) and checks that CHANGELOG.md has an entry for it.
//   bun scripts/bump-version.mjs patch|minor|major|<x.y.z>
// Then: review the diff, commit, tag (git tag vX.Y.Z), push with tags, and `bun run dist` for the installer.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const files = ['package.json', 'apps/api/package.json', 'apps/desktop/package.json', 'packages/contracts/package.json'].map((f) => join(root, f))
const current = JSON.parse(readFileSync(files[0], 'utf8')).version
const arg = process.argv[2]
if (!arg) { console.error(`Current version: ${current}\nUsage: bun scripts/bump-version.mjs patch|minor|major|<x.y.z>`); process.exit(1) }

const [maj, min, pat] = current.split('.').map(Number)
const next = { major: `${maj + 1}.0.0`, minor: `${maj}.${min + 1}.0`, patch: `${maj}.${min}.${pat + 1}` }[arg] ?? arg
if (!/^\d+\.\d+\.\d+$/.test(next)) { console.error(`"${arg}" is not a version`); process.exit(1) }

for (const f of files) {
  const pkg = JSON.parse(readFileSync(f, 'utf8'))
  pkg.version = next
  writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n')
}
const log = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
console.log(`${current} → ${next}`)
if (!log.includes(`## [${next}]`)) console.warn(`! CHANGELOG.md has no "## [${next}]" section yet. Add one before releasing.`)
console.log(`Next: commit, \`git tag v${next}\`, \`git push --follow-tags\`, \`bun run dist\`, then attach the installer to a GitHub release.`)
