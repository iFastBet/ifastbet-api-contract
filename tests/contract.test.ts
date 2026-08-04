import { describe, expect, test } from 'bun:test'
import { collections, contract, operations, path } from '../src/index.js'
import {
  compareBackend,
  compareFrontend,
  extractBackendRoutes,
  extractFrontendSurface,
  validateContract,
} from '../src/check.mjs'

describe('contract manifest', () => {
  test('is internally valid and indexable', () => {
    expect(validateContract(contract)).toEqual([])
    expect(Object.keys(operations)).toHaveLength(contract.routes.length)
    expect(Object.keys(collections)).toHaveLength(12)
  })

  test('builds parameterized paths safely', () => {
    expect(path('dealers.update', { id: 'node/a' })).toBe('/api/dealers/node%2Fa')
    expect(() => path('dealers.update')).toThrow('Missing path parameter')
    expect(() => path('missing')).toThrow('Unknown API operation')
  })
})

describe('source adapters', () => {
  test('extracts frontend routes, collections and query fields', () => {
    const surface = extractFrontendSurface(`
      request("{BACKEND_URL}/api/read", {headers: authHeaders!})
      request('{BACKEND_URL}/api/write', postOpts({}))
      pb.collection("users").getFullList({sort: "-created", expand: "node"})
      pb.collection('games').getFirstListItem('code = "keno"')
    `)

    expect(surface.errors).toEqual([])
    expect(surface.routes).toEqual([
      { method: 'GET', path: '/api/read' },
      { method: 'POST', path: '/api/write' },
    ])
    expect(surface.collections).toEqual(['users', 'games'])
    expect(surface.fields).toContainEqual({ collection: 'users', field: 'created' })
    expect(surface.fields).toContainEqual({ collection: 'users', field: 'node' })
    expect(surface.fields).toContainEqual({ collection: 'games', field: 'code' })
  })

  test('fails closed when frontend request syntax drifts', () => {
    const surface = extractFrontendSurface(`
      request("{BACKEND_URL}/api/known", postOpts({}))
      request('{BACKEND_URL}/api/unknown', customOpts({}))
    `)
    expect(surface.errors).toContain('unsupported request options helper "customOpts" for /api/unknown')
  })

  test('extracts backend routes', () => {
    const extracted = extractBackendRoutes(`
      routerAdd "POST", "/api/one", do(e)
      routerAdd 'PATCH', '/api/items/{id}', do(e)
    `, 'api.imba')

    expect(extracted.mentions).toBe(2)
    expect(extracted.routes).toEqual([
      { method: 'POST', path: '/api/one', file: 'api.imba' },
      { method: 'PATCH', path: '/api/items/{id}', file: 'api.imba' },
    ])
  })
})

describe('consumer checks', () => {
  const fixture = {
    version: 'test',
    routes: [{ operation: 'items.read', method: 'POST', path: '/api/items/read' }],
    pocketbase: { collections: { items: { queryFields: ['created_at'] } } },
  }

  test('reports frontend references outside the contract', () => {
    const surface = extractFrontendSurface(`
      request("{BACKEND_URL}/api/missing", postOpts({}))
      pb.collection('items').getFullList({sort: '-bogus'})
    `)
    expect(compareFrontend(surface, fixture)).toEqual([
      'route POST /api/missing is not declared in the contract',
      'query field items.bogus is not declared in the contract',
    ])
  })

  test('reports contract entries absent from the backend', () => {
    const failures = compareBackend(
      fixture,
      [{ method: 'POST', path: '/api/other' }],
      new Map([['items', new Set(['id'])]]),
      'snapshot.js',
    )
    expect(failures).toEqual([
      'contract route POST /api/items/read is missing from backend sources',
      'contract field items.created_at is missing from snapshot.js',
    ])
  })
})
