#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import process from "node:process"

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
    if (args.length !== 1 || !["providers", "models"].includes(args[0])) {
      console.error("Usage: integral-modelos-data.js providers | models")
      process.exitCode = 2
      return
    }
    const providers = await api("/api/provider")
    let result
    if (args[0] === "providers") {
      result = providers.map(({ id, name, activation }) => ({ id, name, activation }))
    } else {
      const activeIDs = new Set(providers.map((provider) => provider.id))
      const models = await api("/api/model")
      result = models
        .filter((model) =>
          activeIDs.has(model.providerID) &&
          (model.type ?? "chat") === "chat" &&
          model.enabled !== false &&
          (model.status ?? "active") === "active",
        )
        .map((model) => Object.fromEntries(MODEL_FIELDS
          .filter((field) => field in model)
          .map((field) => [field, model[field]])))
    }
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`Could not read the OpenCode model catalog: ${error.message}`)
    process.exitCode = 1
  }
}

async function api(endpoint) {
  const result = spawnSync("opencode", ["api", "get", endpoint], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: process.platform === "win32",
  })
  if (result.error) throw new Error(`Could not run the OpenCode CLI: ${result.error.message}`)
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
