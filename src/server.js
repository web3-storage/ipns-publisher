import http from 'http'
import { broadcast, siteRoot } from './inbound.js'

const port = parseInt(process.env.INBOUND_PORT || 8000, 10)
const routes = {
  '/': siteRoot,
  '/broadcast': broadcast
}

const response404 = {
  status: 404,
  json: { message: 'not found' }
}

function response500 (error) {
  return {
    status: 500,
    message: `Error: ${error.message}`
  }
}

/**
 * HTTP server entrypoint. This may be changed depending on how/where we run this.
 */
async function router (request, response) {
  let res
  try {
    const handler = routes[request.url]
    if (handler === undefined) {
      res = response404
    } else {
      res = await handler(request)
    }
  } catch (error) {
    res = response500(error)
  }
  const json = res.json
  const html = res.html

  const status = (json || html)
    ? (res.status || 200)
    : 500

  const headers = res.headers || {}
  if (json) {
    headers['Content-type'] = 'application/json;charset=utf8'
  } else {
    headers['Content-type'] = 'text/html;charset=utf8'
  }
  response.writeHead(status, headers)
  response.end(json ? JSON.stringify(json) : html)
  console.log(`[${status}] ${request.url}`)
}

const server = http.createServer(router)
server.listen(port, () => {
  console.log(`Inbound server is running on ${port}`)
})
