import assert from 'node:assert/strict'
import test from 'node:test'
import { guardPublicMcpRequest } from './public-demo-guard.server.ts'

test('MCP public guard is inactive for the local workshop', async () => {
  const request = new Request('http://localhost/mcp', {
    headers: { 'content-length': '999999' },
  })
  assert.equal(await guardPublicMcpRequest(request, {}), null)
})

test('MCP public guard rejects an oversized declared request', async () => {
  const request = new Request('https://demo.example/mcp', {
    headers: { 'content-length': '999999' },
  })
  const response = await guardPublicMcpRequest(request, {
    ENABLE_PUBLIC_MCP_GUARDS: 'true',
  })
  assert.equal(response?.status, 413)
})

test('MCP public guard measures a body without content-length', async () => {
  const request = new Request('https://demo.example/mcp', {
    method: 'POST',
    body: '123456',
  })
  request.headers.delete('content-length')
  const response = await guardPublicMcpRequest(request, {
    ENABLE_PUBLIC_MCP_GUARDS: 'true',
    MCP_MAX_REQUEST_BYTES: '5',
  })
  assert.equal(response?.status, 413)
})
