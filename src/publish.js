/* global AbortController */
import * as uint8arrays from 'uint8arrays'
import debug from 'debug'
import formatNumber from 'format-number'
import PQueue from 'p-queue'
import { shorten } from './utils/string.js'
import { create as createIpfs } from 'ipfs-http-client'

export const ipfs = createIpfs()

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export const sleepTimer = 60_000

const CONCURRENCY = 5
const DHT_PUT_TIMEOUT = 60_000
const fmt = formatNumber()

const log = debug('ipns-pub')
log.enabled = true
log.debug = debug('ipns-pub-debug')

/** @type {Map<string, { record: string }>} */
const taskData = new Map()
/** @type {Set<string>} */
const runningTasks = new Set()
export const queue = new PQueue({ concurrency: CONCURRENCY })

/**
 * Queues the IPNS record to be added to the DHT.
 * @param {string} key Public key of the record.
 * @param {string} value The `value` field of the record.
 * @param {string} b64record Base 64 encoded serialized IPNS record.
 * @returns {undefined}
 */
export async function addToQueue (key, value, b64record) {
  const keyLog = log.extend(shorten(key))
  keyLog.enabled = true

  let data = taskData.get(key)
  if (data) {
    Object.assign(data, { value, b64record })
    return keyLog('👌 Already in the queue (record to publish has been updated)')
  }

  data = { value, b64record }
  taskData.set(key, data)

  const start = Date.now()
  keyLog(`➕ Adding to the queue, position: ${fmt(queue.size)}`)
  queue.add(async function run () {
    // if this task is already running, lets not concurrently put
    // multiple versions for the same key!
    if (runningTasks.has(key)) {
      keyLog('🏃 Already running! Re-queue in 60s...')
      await sleep(sleepTimer)
      if (taskData.has(key) && taskData.get(key) !== data) {
        return keyLog('⏩ Skipping re-queue, a newer update has been queued already.')
      }

      // Add back into queue
      taskData.set(key, data)
      keyLog(`➕ Re-adding to the queue, position: ${fmt(queue.size)}`)
      queue.add(run)
      return
    }

    keyLog(`🏁 Starting publish (was queued for ${fmt(Date.now() - start)}ms)`)
    runningTasks.add(key)

    try {
      const data = taskData.get(key)
      if (!data) throw new Error('missing task data')
      taskData.delete(key)
      publishRecord(key, data.value, data.b64record)
    } finally {
      runningTasks.delete(key)
    }
  })
}

/**
 * Publish the given base64-encoded IPNS record for the given public key to the DHT.
 * @param {string} key Public key of the record.
 * @param {string} value The `value` field of the record.
 * @param {string} b64record Base 64 encoded serialized IPNS record.
 * @returns {undefined}
 */
export async function publishRecord (key, value, b64record) {
  const keyLog = log.extend(shorten(key))
  const start = Date.now()
  let timeoutId
  try {
    keyLog(`📣 Publishing /ipns/${key} ➡️ ${value}`)
    keyLog.enabled = true
    const recordUint8 = uint8arrays.fromString(b64record, 'base64pad')

    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), DHT_PUT_TIMEOUT)

    for await (const e of ipfs.dht.put(`/ipns/${key}`, recordUint8, { signal: controller.signal })) {
      logQueryEvent(log.debug.extend(shorten(key)), e)
    }
    keyLog(`✅ Published in ${fmt(Date.now() - start)}ms`)
  } catch (err) {
    keyLog(`⚠️ Failed to put to DHT (took ${fmt(Date.now() - start)}ms)`, err)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * @param {debug.Debugger} log
 * @param {import('ipfs-core-types/src/dht').QueryEvent} e
 */
function logQueryEvent (log, e) {
  switch (e.name) {
    case 'VALUE':
      log(`Type: ${e.name} From: ${e.from} Value: ${uint8arrays.toString(e.value, 'base64pad')}`)
      break
    case 'SENDING_QUERY':
      log(`Type: ${e.name} To: ${e.to}`)
      break
    case 'PEER_RESPONSE':
      log(`Type: ${e.name} From: ${e.from} Message: ${e.messageName} Closer: ${e.closer.length} Providers: ${e.providers.length}`)
      break
    case 'DIALING_PEER':
      log(`Type: ${e.name} Peer: ${e.peer}`)
      break
    default:
      log(`Type: ${e.name}`)
  }
}
