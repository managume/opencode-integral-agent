#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import process from "node:process"
import path from "node:path"

const MODEL_FIELDS = [
  "id",
  "modelID",
  "providerID",
  "name",
  "type",
  "capabilities",
  "variants",
  "cost",
  "status",
  "enabled",
  "limit",
]

export async function main(args = process.argv.slice(2)) {
  try {
    const result = await loadCatalog(args, { cwd: process.cwd() })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`Could not read the OpenCode model catalog: ${error.message}`)
    process.exitCode = 1
  }
}

export async function loadCatalog(args, { cwd = process.cwd(), run = spawnSync } = {}) {
  if (!Array.isArray(args) || args.length < 1 || args.length > 2 || !["providers", "models"].includes(args[0])) {
    throw new Error("Usage: integral-modelos-data.js providers|models [project-directory]")
  }
  const [kind, requestedDirectory] = args
  const directory = path.resolve(requestedDirectory ?? cwd)
  const providers = await api("/api/provider", directory, run)
  if (kind === "providers") {
    return providers.map(({ id, name, activation }) => ({ id, name, activation }))
  }
  const activeIDs = new Set(providers
    .filter((provider) => provider.activation !== "disabled")
    .map((provider) => provider.id))
  const models = await api("/api/model", directory, run)
  return models
    .filter((model) =>
      activeIDs.has(model.providerID) &&
      (model.type ?? "chat") === "chat" &&
      model.enabled !== false &&
      (model.status ?? "active") === "active",
    )
    .map(sanitizeModel)
}

export function sanitizeModel(model) {
  const safe = Object.fromEntries(MODEL_FIELDS
    .filter((field) => field !== "variants" && field in model)
    .map((field) => [field, model[field]]))
  if (Array.isArray(model.variants)) {
    safe.variants = model.variants
      .filter((variant) => typeof variant?.id === "string")
      .map(({ id }) => ({ id }))
  }
  return safe
}

export function endpointForLocation(endpoint, directory) {
  const url = new URL(endpoint, "http://opencode.local")
  url.searchParams.set("location[directory]", path.resolve(directory))
  return `${url.pathname}${url.search}`
}

async function api(endpoint, directory, run) {
  const localizedEndpoint = endpointForLocation(endpoint, directory)
  const result = run("opencode", ["api", "get", localizedEndpoint], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: process.platform === "win32",
    timeout: 20_000,
    killSignal: "SIGTERM",
  })
  if (result.error?.code === "ETIMEDOUT") throw new Error(`OpenCode API request timed out for ${endpoint}.`)
  if (result.error) throw new Error(`Could not run the OpenCode CLI: ${result.error.message}`)
  if (result.signal) throw new Error(`OpenCode API request timed out or was interrupted for ${endpoint}.`)
  if (result.status !== 0) throw new Error(`OpenCode API request failed for ${endpoint} (exit ${result.status}).`)
  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    throw new Error(`OpenCode returned invalid JSON for ${endpoint}.`)
  }
  if (!Array.isArray(payload?.data)) throw new Error(`OpenCode returned an unexpected response for ${endpoint}.`)
  return payload.data
}
