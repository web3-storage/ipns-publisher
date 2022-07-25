import websocket from 'websocket'
import dotenv from 'dotenv'
import debug from 'debug'
import { addToQueue } from './publish.js'

dotenv.config()

const WebSocket = websocket.client
const log = debug('ipns-pub')
log.enabled = true
log.debug = debug('ipns-pub-debug')

/**
 * Listen to the websocket on the w3name service to receive updates to IPNS name records
 * and publish those updates to the DHT.
 */
async function main () {
  log('ℹ️ Enable verbose logging with DEBUG=ipns-pub-debug*')
  const endpoint = process.env.ENDPOINT || 'wss://api.web3.storage'
  const url = new URL('name/*/watch', endpoint)

  while (true) {
    /** @type {import('websocket').connection} */
    const conn = await new Promise((resolve, reject) => {
      const client = new WebSocket()
      client.connect(url.toString())
      client.on('connect', resolve).on('connectFailed', reject)
    })

    log(`🔌 Websocket connected to ${url}`)

    try {
      await new Promise((resolve, reject) => {
        conn.on('message', async msg => {
          const { key, value, record: b64Record } = JSON.parse(msg.utf8Data)

          await addToQueue(key, value, b64Record)
        })

        conn.on('error', err => reject(err))

        conn.on('close', (code, desc) => {
          reject(Object.assign(new Error(`websocket connection closed: ${desc}`), { code }))
        })
      })
    } catch (err) {
      log(err)
    }

    log('💤 Sleeping before retry')
    await sleep(60_000)
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

main()
