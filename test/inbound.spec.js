/* eslint-env mocha */
import assert from 'assert'
import sinon from 'sinon'
import { broadcast } from '../src/inbound.js'
import { queue } from '../src/publish.js'
import { mockValidBroadcastBody, MockRequest } from './scripts/mocks.js'

describe('/broadcast endpoint', () => {
  it('should enforce required keys in JSON payload', async () => {
    const request = new MockRequest()
    const responsePromise = broadcast(request)
    request.write(JSON.stringify({}))
    request.end()

    const response = await responsePromise
    assert.equal(response.status, 400)
    assert.equal(response.json.message, 'JSON payload missing key \'key\'')
  })

  it('should add the record to the queue', async () => {
    const queueSpy = sinon.stub(queue, 'add').callsFake(() => {})

    const request = new MockRequest()
    const responsePromise = broadcast(request)
    request.write(JSON.stringify(mockValidBroadcastBody))
    request.end()
    const response = await responsePromise

    assert.equal(response.status, 200)
    assert.equal(response.json.message, 'Record added to queue for publishing.')
    assert(queueSpy.calledOnce, 'Record is added to the queue.')
    queueSpy.restore()
  })
})
