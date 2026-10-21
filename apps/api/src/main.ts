import { createApp } from './app'
import { loadConfig } from './shared/config'
import { openDatabase } from './shared/db'

const config = loadConfig()
const db = openDatabase(config.dbPath)
const app = createApp({ config, db })

// Bind to loopback only; port 0 lets the OS pick a free one.
app.listen({ hostname: '127.0.0.1', port: config.port })

// Electron main parses this single line to learn the port. It never contains the token.
console.log(`MOHHEY_API_READY ${JSON.stringify({ port: app.server?.port })}`)

const shutdown = () => {
  app.stop()
  db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
// When the parent (Electron) goes away its pipe closes; exit with it.
process.stdin.on('end', shutdown)
process.stdin.resume()
