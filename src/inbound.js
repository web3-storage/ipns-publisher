import * as ipns from 'ipns'
import { validate as ipnsValidate } from 'ipns/validator'
import { keys } from 'libp2p-crypto'
import * as Digest from 'multiformats/hashes/digest'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { parseAndValidateCID } from './utils/ipfs.js'
import { getBody } from './utils/http/requests.js'
import { addToQueue } from './publish.js'

/**
 * Receive a POST request containing an IPNS record and publish it to the DHT.
 * Expects a JSON payload containing:
 *  - `key` - key of the record to be published.
 *  - `record` - base64-encoded record to be published.
 * @returns {Promise<JSONResponse>}
 */
export async function broadcast (request) {
  const body = (await getBody(request)) || '{}' // Avoid JSON parse error if empty

  const payload = JSON.parse(body)
  for (const name of ['key', 'record']) {
    if (payload[name] === undefined) {
      return {
        status: 400,
        json: { message: `JSON payload missing key '${name}'` }
      }
    }
  }
  const { key, record } = payload
  let keyCid
  try {
    keyCid = parseAndValidateCID(key)
  } catch (error) {
    return {
      status: 400,
      json: { message: error.message }
    }
  }

  let entry
  let pubKey

  try {
    entry = ipns.unmarshal(uint8ArrayFromString(record, 'base64pad'))
  } catch (error) {
    return {
      status: 400,
      json: { message: `Invalid record: ${error.message}` }
    }
  }

  try {
    pubKey = keys.unmarshalPublicKey(Digest.decode(keyCid.multihash.bytes).bytes)
  } catch (error) {
    return {
      status: 400,
      json: { message: `Invalid key: ${error.message}` }
    }
  }

  try {
    await ipnsValidate(pubKey, entry)
  } catch (error) {
    return {
      status: 400,
      json: { message: `invalid ipns entry: ${error.message}` }
    }
  }

  if (entry.pubKey !== undefined && !keys.unmarshalPublicKey(entry.pubKey).equals(pubKey)) {
    return {
      status: 404,
      json: { message: 'embedded public key mismatch' }
    }
  }

  // TODO: Fetch the existing record from the DHT to check that the one we're trying to
  // publish is newer.  This isn't a massive problem, as we've checked the signature, so
  // someone can only overwrite their own records, and the DHT garbage collection will
  // sort them out eventually anyway, but it might be a nice thing to add.

  addToQueue(key, entry.value, record)

  return {
    status: 200,
    json: { message: 'Record added to queue for publishing.' }
  }
}

/**
 * Basic page for the root URL.
 */
export function siteRoot () {
  return {
    status: 200,
    html: `<body style="font-family: -apple-system, system-ui">
      <h1>⁂</h1>
      <p>IPNS records can be published to the /broadcast endpoint.</p>
    </body>`
  }
}
