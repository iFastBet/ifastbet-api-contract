import contract from '../contract.json' with { type: 'json' }

export { contract }

export const operations = Object.freeze(Object.fromEntries(
  contract.routes.map(route => [route.operation, Object.freeze(route)]),
))

export const collections = Object.freeze(contract.pocketbase.collections)

export function path(operation, params = {}) {
  const route = operations[operation]
  if (!route) throw new Error(`Unknown API operation: ${operation}`)

  const result = route.path.replace(/\{([^}]+)\}/g, (_, name) => {
    if (!(name in params)) throw new Error(`Missing path parameter "${name}" for ${operation}`)
    return encodeURIComponent(String(params[name]))
  })

  return result
}
