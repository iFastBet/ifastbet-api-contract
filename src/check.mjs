import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OPT_METHODS = { postOpts: 'POST', patchOpts: 'PATCH', deleteOpts: 'DELETE' }
const CONTRACT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'contract.json')

function unique(items, keyOf) {
  const seen = new Set()
  return items.filter(item => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function nextCollection(lines, from, span = 8) {
  for (let i = from + 1; i <= Math.min(from + span, lines.length - 1); i++) {
    const match = /pb\.collection\s*\(\s*(['"])([\w-]+)\1\s*\)/.exec(lines[i])
    if (match) return match[2]
  }
  return null
}

export function loadContract(file = CONTRACT_FILE) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function validateContract(contract) {
  const failures = []
  const operations = new Set()
  const routes = new Set()

  if (!contract || typeof contract !== 'object') return ['contract must be an object']
  if (!contract.version) failures.push('contract.version is required')
  if (!Array.isArray(contract.routes)) failures.push('contract.routes must be an array')

  for (const route of contract.routes || []) {
    if (!route.operation || !route.method || !route.path) {
      failures.push('every route requires operation, method and path')
      continue
    }
    if (operations.has(route.operation)) failures.push(`duplicate operation ${route.operation}`)
    operations.add(route.operation)

    const key = `${route.method.toUpperCase()} ${route.path}`
    if (routes.has(key)) failures.push(`duplicate route ${key}`)
    routes.add(key)
  }

  const collections = contract.pocketbase?.collections
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    failures.push('contract.pocketbase.collections must be an object')
  } else {
    for (const [name, value] of Object.entries(collections)) {
      if (!name) failures.push('collection name cannot be empty')
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        failures.push(`collection ${name} must be an object`)
      } else if (value.queryFields && !Array.isArray(value.queryFields)) {
        failures.push(`collection ${name}.queryFields must be an array`)
      }
    }
  }

  return failures
}

export function extractFrontendSurface(source) {
  const errors = []
  const routes = []
  const routeMentions = [...source.matchAll(/\brequest\s*\(\s*(['"])\{BACKEND_URL\}\//g)].length
  const routePattern = /\brequest\s*\(\s*(['"])\{BACKEND_URL\}(\/[^'"]+)\1\s*,\s*([A-Za-z_$][\w$]*|\{)/g

  for (const match of source.matchAll(routePattern)) {
    const options = match[3]
    let method = 'GET'
    if (options !== '{') {
      method = OPT_METHODS[options]
      if (!method) {
        errors.push(`unsupported request options helper "${options}" for ${match[2]}`)
        continue
      }
    }
    routes.push({ method, path: match[2] })
  }

  if (routes.length + errors.length !== routeMentions) {
    errors.push(`request parser drift: found ${routeMentions} BACKEND_URL calls but parsed ${routes.length + errors.length}`)
  }

  const collectionMentions = [...source.matchAll(/\bpb\.collection\s*\(/g)].length
  const collections = [...source.matchAll(/pb\.collection\s*\(\s*(['"])([\w-]+)\1\s*\)/g)].map(match => match[2])
  if (collections.length !== collectionMentions) {
    errors.push(`collection parser drift: found ${collectionMentions} pb.collection calls but parsed ${collections.length}`)
  }

  const fields = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const inlineMatch = /pb\.collection\s*\(\s*(['"])([\w-]+)\1\s*\)/.exec(line)
    const inline = inlineMatch ? inlineMatch[2] : null

    const sortInline = /sort:\s*(['"])-?(\w+)\1/.exec(line)
    if (sortInline && inline) fields.push({ collection: inline, field: sortInline[2] })

    const expand = /expand:\s*(['"])([^'"]+)\1/.exec(line)
    if (expand && inline) {
      for (const field of expand[2].split(',')) fields.push({ collection: inline, field: field.trim() })
    }

    const filter = /getFirstListItem\s*\(\s*(['"])(\w+)\s*=/.exec(line)
    if (filter && inline) fields.push({ collection: inline, field: filter[2] })

    const sortDefault = /sort\s*=\s*(?:\w+\.\w+\s+or\s+)?(['"])-(\w+)\1/.exec(line)
    if (sortDefault && !sortInline) {
      const collection = inline || nextCollection(lines, i)
      if (collection) fields.push({ collection, field: sortDefault[2] })
    }
  }

  return {
    routes: unique(routes, route => `${route.method} ${route.path}`),
    collections: [...new Set(collections)],
    fields: unique(fields, ref => `${ref.collection}.${ref.field}`),
    errors,
    counts: { routeMentions, collectionMentions },
  }
}

export function extractBackendRoutes(source, file = '<source>') {
  const routes = []
  const mentions = [...source.matchAll(/\brouterAdd\s*['"]/g)].length
  const pattern = /\brouterAdd\s*(['"])([A-Za-z]+)\1\s*,\s*(['"])(\/[^'"]+)\3/g
  for (const match of source.matchAll(pattern)) {
    routes.push({ method: match[2].toUpperCase(), path: match[4], file })
  }
  return { routes, mentions }
}

function imbaFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...imbaFiles(target))
    else if (entry.isFile() && entry.name.endsWith('.imba')) files.push(target)
  }
  return files
}

function loadBackendRoutes(backendSrc) {
  const routes = []
  let mentions = 0
  for (const file of imbaFiles(backendSrc)) {
    const extracted = extractBackendRoutes(fs.readFileSync(file, 'utf8'), path.relative(backendSrc, file))
    routes.push(...extracted.routes)
    mentions += extracted.mentions
  }
  return { routes, mentions }
}

function loadSnapshotCollections(migrationsDir) {
  const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.js')).sort().reverse()
  for (const file of files) {
    const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    if (!/importCollections\(/.test(source)) continue

    let up = null
    new Function('migrate', source)(callback => { up = callback })
    if (!up) continue

    const fakeApp = {
      findCollectionByNameOrId: () => { throw new Error('absent') },
      delete: () => {},
      importCollections: snapshot => snapshot,
    }
    const snapshot = up(fakeApp)
    const map = new Map()
    for (const collection of snapshot) {
      const fields = new Set((collection.fields || []).map(field => field.name))
      fields.add('id')
      fields.add('created')
      fields.add('updated')
      map.set(collection.name, fields)
    }
    return { file, map }
  }
  return null
}

const routeKey = route => `${route.method.toUpperCase()} ${route.path}`

export function compareFrontend(frontend, contract) {
  const failures = [...frontend.errors]
  const routes = new Set(contract.routes.map(routeKey))
  const collections = contract.pocketbase.collections

  for (const route of frontend.routes) {
    const key = routeKey(route)
    if (!routes.has(key)) failures.push(`route ${key} is not declared in the contract`)
  }

  for (const name of frontend.collections) {
    if (!collections[name]) failures.push(`collection ${name} is not declared in the contract`)
  }

  for (const { collection, field } of frontend.fields) {
    const fields = collections[collection]?.queryFields || []
    if (!fields.includes(field)) failures.push(`query field ${collection}.${field} is not declared in the contract`)
  }

  return failures
}

export function compareBackend(contract, backendRoutes, collections, snapshotFile = '<snapshot>') {
  const failures = []
  const routes = new Set(backendRoutes.map(routeKey))

  for (const route of contract.routes) {
    const key = routeKey(route)
    if (!routes.has(key)) failures.push(`contract route ${key} is missing from backend sources`)
  }

  for (const [name, definition] of Object.entries(contract.pocketbase.collections)) {
    const schemaFields = collections.get(name)
    if (!schemaFields) {
      failures.push(`contract collection ${name} is missing from ${snapshotFile}`)
      continue
    }
    for (const field of definition.queryFields || []) {
      if (!schemaFields.has(field)) failures.push(`contract field ${name}.${field} is missing from ${snapshotFile}`)
    }
  }

  return failures
}

export function checkAdminka(adminkaDir, contract = loadContract()) {
  const apiFile = path.join(path.resolve(adminkaDir), 'src', 'api.imba')
  if (!fs.existsSync(apiFile)) throw new Error(`adminka API module not found: ${apiFile}`)
  const frontend = extractFrontendSurface(fs.readFileSync(apiFile, 'utf8'))
  return { frontend, failures: [...validateContract(contract), ...compareFrontend(frontend, contract)] }
}

export function checkBackend(backendDir, contract = loadContract()) {
  const root = path.resolve(backendDir)
  const backendSrc = path.join(root, 'src')
  const migrationsDir = path.join(root, 'pb_migrations')
  if (!fs.existsSync(backendSrc)) throw new Error(`backend src not found: ${backendSrc}`)
  if (!fs.existsSync(migrationsDir)) throw new Error(`backend migrations not found: ${migrationsDir}`)

  const backend = loadBackendRoutes(backendSrc)
  const failures = validateContract(contract)
  if (backend.routes.length !== backend.mentions) {
    failures.push(`backend route parser drift: found ${backend.mentions} routerAdd calls but parsed ${backend.routes.length}`)
  }

  const snapshot = loadSnapshotCollections(migrationsDir)
  if (!snapshot) throw new Error(`no importCollections snapshot found in ${migrationsDir}`)
  failures.push(...compareBackend(contract, backend.routes, snapshot.map, snapshot.file))
  return { backend, snapshot, failures }
}
