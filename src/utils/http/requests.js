/**
 * Utility to get the body from a request.
 * @param {import('http').ClientRequest} request
 * @returns {Promise<string>}
 */
export function getBody (request) {
  const promise = new Promise((resolve, reject) => {
    let body = []
    request.on('data', (chunk) => {
      body.push(chunk)
    }).on('end', () => {
      body = Buffer.concat(body).toString()
      resolve(body)
    })
  })
  return promise
}
