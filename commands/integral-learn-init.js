#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { mkdir, open, lstat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"

const GLOBAL_TEMPLATE = `# Global procedural memory

Durable, general collaboration preferences. Do not store sensitive data or project-specific technical details.

## Preferences
`

const PROJECT_TEMPLATE = `# Project memory

Collaboration preferences specific to this project's requirements or workflow. Technical details belong in project documentation.

## Preferences
`

export async function main(options = {}) {
  const configDir = path.resolve(options.configDir ?? process.env.OPENCODE_CONFIG_DIR ??
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode"))
  const root = await projectRoot(process.cwd())
  const results = [
    ["Global", path.join(configDir, "LEARN.md"), GLOBAL_TEMPLATE],
    ["Project", path.join(root, ".opencode", "LEARN.md"), PROJECT_TEMPLATE],
  ]
  let failed = false
  for (const [scope, file, content] of results) {
    try {
      console.log(`${scope}: ${file} — ${await createIfMissing(file, content)}`)
    } catch (error) {
      failed = true
      console.error(`${scope}: ${file} — error: ${error.message}`)
    }
  }
  if (failed) process.exitCode = 1
}

async function projectRoot(cwd) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  return result.status === 0 ? path.resolve(result.stdout.trim()) : cwd
}

async function createIfMissing(file, content) {
  try {
    await lstat(file)
    return "already exists; preserved"
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  await mkdir(path.dirname(file), { recursive: true })
  let handle
  try {
    handle = await open(file, "wx", 0o600)
    await handle.writeFile(content, "utf8")
    return "initialized"
  } catch (error) {
    if (error.code === "EEXIST") return "created by another run; preserved"
    throw error
  } finally {
    await handle?.close()
  }
}
