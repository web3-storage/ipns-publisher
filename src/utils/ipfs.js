import { create as createIpfs } from 'ipfs-http-client'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'

const libp2pKeyCode = 0x72

/**
 * Get the existing stored value (if any) for the given name from the DHT.
 * @param {string} name
 * @returns {Promise<string | undefined>}
 */
export async function getValueFromDHT (key) {
  // See: https://github.com/ipfs/js-ipfs/blob/master/packages/ipfs-http-client/src/dht/get.js
  // and: https://github.com/ipfs/js-ipfs/blob/master/packages/interface-ipfs-core/src/dht/get.js#L60
  const ipfs = createIpfs()
  for await (const event of ipfs.dht.get(`/ipns/${key}`)) {
    if (event.name === 'VALUE') {
      return event.value
    }
  }
}

/**
 * @param {CID} cid
 */
function validateCIDKeyCode (cid) {
  if (cid.code !== libp2pKeyCode) {
    throw new Error(`invalid key, expected: ${libp2pKeyCode} codec code but got: ${cid.code}`)
  }
}

/**
 * @param {string} cid
 */
export function parseAndValidateCID (key) {
  let cid
  try {
    cid = CID.parse(key, base36)
  } catch (err) {
    throw new Error('invalid key')
  }
  validateCIDKeyCode(cid)
  return cid
}
