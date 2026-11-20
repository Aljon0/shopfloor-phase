import 'dotenv/config'
import { createApp } from './app'
import { loadEnv } from './config/env'
import { createDb } from './db/client'

const env = loadEnv()
const db = createDb(env.DATABASE_URL)
const app = createApp({ db, env })

const server = app.listen(env.PORT, () => {
  console.log(`ShopFloor API listening on port ${env.PORT} (${env.NODE_ENV})`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down`)
  server.close(async () => {
    await db.$disconnect()
    process.exit(0)
  })
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
