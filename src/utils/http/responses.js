/* eslint-env serviceworker */

/**
 * @param {import('http').ServerResponse} response
 * @param {object} data
 * @param {number} status
 */
export function writeJSONResponse (response, data, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json;charset=UTF-8' })
  response.end(JSON.stringify(data))
}

/**
 * @param {import('http').ServerResponse} response
 * @param {string} message
 */
export function writeJSON404 (response, message = 'Not Found') {
  writeJSONResponse(response, { message }, 404)
}

/**
 * Write a JSON payload to the given response with info about the given error.
 * @param {import('http').ServerResponse} response
 * @param {Error} err
 */
export function writeJSON500 (response, err) {
  console.error(err.stack)
  const error = {
    code: err.code,
    message: err.message
  }
  writeJSONResponse(response, error, 500)
}
