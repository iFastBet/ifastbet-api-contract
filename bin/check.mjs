#!/usr/bin/env bun

import path from 'node:path'
import { checkAdminka, checkBackend, loadContract, validateContract } from '../src/check.mjs'

function parseArgs(argv) {
  const result = { mode: null, target: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--contract') result.mode = 'contract'
    else if (arg === '--adminka' || arg === '--backend') {
      result.mode = arg.slice(2)
      result.target = argv[++i]
      if (!result.target) throw new Error(`${arg} requires a repository path`)
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  if (!result.mode) throw new Error('use --contract, --adminka <path> or --backend <path>')
  return result
}

function printResult(label, details, failures) {
  console.log(`ifastbet-api-contract ${label}`)
  for (const detail of details) console.log(`  ${detail}`)

  if (failures.length) {
    console.log(`\nFAIL — ${failures.length} issue${failures.length === 1 ? '' : 's'}:`)
    for (const failure of failures) console.log(`  ✗ ${failure}`)
    return 1
  }

  console.log('\nPASS')
  return 0
}

export function main(argv = process.argv.slice(2)) {
  const cli = parseArgs(argv)
  const contract = loadContract()

  if (cli.mode === 'contract') {
    return printResult('contract', [
      `version     : ${contract.version}`,
      `routes      : ${contract.routes.length}`,
      `collections : ${Object.keys(contract.pocketbase.collections).length}`,
    ], validateContract(contract))
  }

  if (cli.mode === 'adminka') {
    const target = path.resolve(cli.target)
    const result = checkAdminka(target, contract)
    return printResult('adminka', [
      `repository  : ${target}`,
      `contract    : ${contract.version}`,
      `surface     : ${result.frontend.routes.length} routes, ${result.frontend.collections.length} collections, ${result.frontend.fields.length} query fields`,
    ], result.failures)
  }

  const target = path.resolve(cli.target)
  const result = checkBackend(target, contract)
  return printResult('pocketbase', [
    `repository  : ${target}`,
    `contract    : ${contract.version}`,
    `backend     : ${result.backend.routes.length} routes`,
    `schema      : ${result.snapshot.map.size} collections (${result.snapshot.file})`,
  ], result.failures)
}

if (import.meta.main) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(`ifastbet-contract-check: ${error.message}`)
    process.exitCode = 1
  }
}
