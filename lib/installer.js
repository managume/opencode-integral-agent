import { createHash, randomBytes } from "node:crypto"
import {
  chmod,
  copyFile,
  cp,
  lstat,
  stat,
  mkdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import jsoncParser from "jsonc-parser"

const { applyEdits, getParseErrorCode, modify, parse } = jsoncParser

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PACKAGE = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "package.json"), "utf8"))
const ASSETS = [
  "agents/integral.md",
  "commands/integral-init.md",
  "commands/integral-learn.md",
  "commands/integral-modelos.md",
  "commands/integral-learn-init.js",
  "commands/integral-modelos-data.js",
  "plugins/integral-model-switch",
  "plugins/integral-sidebar",
]
const ASSET_DIRECTORIES = new Set(["plugins/integral-model-switch", "plugins/integral-sidebar"])
const GLOBAL_FILES = [
  ["agents/integral.md", "agents/integral.md"],
  ["commands/integral-init.md", "commands/integral-init.md"],
  ["commands/integral-learn.md", "commands/integral-learn.md"],
  ["commands/integral-modelos.md", "commands/integral-modelos.md"],
]
const JSON_FORMAT = { insertSpaces: true, tabSize: 2, eol: "\n" }
const CONFIG_DIR = path.resolve(
  process.env.OPENCODE_CONFIG_DIR ||
    path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode"),
)
const LOCK_NAME = ".integral-install.lock"

export async function runInstaller(argv) {
  const options = parseArgs(argv)
  if (options.help) return printHelp()
  if (options.version) return console.log(PACKAGE.version)
  validateRuntime()

  const configDir = path.resolve(options.configDir ?? CONFIG_DIR)
  if (isWithin(PACKAGE_ROOT, configDir) || isWithin(configDir, PACKAGE_ROOT)) {
    throw new Error("The OpenCode config directory must be separate from the installer package.")
  }

  const configFiles = await inspectConfigFiles(configDir)
  if (options.check) return checkInstallation(configDir, configFiles)
  if (options.dryRun) return printDryRun(configDir, configFiles)

  await mkdir(configDir, { recursive: true })
  const releaseRoot = path.join(configDir, "integral", "releases")
  await mkdir(releaseRoot, { recursive: true })
  const lock = await acquireLock(configDir)
  try {
    await install(configDir, releaseRoot, configFiles)
  } finally {
    await lock.release()
  }
}

function parseArgs(argv) {
  const result = { configDir: undefined, check: false, dryRun: false, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--config-dir") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("--config-dir requires a path.")
      result.configDir = argv[++i]
    } else if (arg === "--check") result.check = true
    else if (arg === "--dry-run") result.dryRun = true
    else if (arg === "--help" || arg === "-h") result.help = true
    else if (arg === "--version" || arg === "-v") result.version = true
    else throw new Error(`Unknown option: ${arg}. Use --help to see supported options.`)
  }
  if (result.check && result.dryRun) throw new Error("Choose either --check or --dry-run.")
  if (result.version && (result.check || result.dryRun || result.configDir)) {
    throw new Error("--version cannot be combined with other options.")
  }
  return result
}

function validateRuntime() {
  const nodeMajor = Number(process.versions.node.split(".")[0])
  if (nodeMajor < 20) throw new Error(`Node.js 20 or later is required; found ${process.versions.node}.`)
  const npmVersion = process.env.npm_config_user_agent?.match(/\bnpm\/(\d+)/)?.[1]
  if (npmVersion && Number(npmVersion) < 7) {
    throw new Error(`npm 7 or later is required; found npm/${npmVersion}.`)
  }
}

async function inspectConfigFiles(configDir) {
  const serverJSONC = path.join(configDir, "opencode.jsonc")
  const serverJSON = path.join(configDir, "opencode.json")
  const hasJSONC = await exists(serverJSONC)
  const hasJSON = await exists(serverJSON)
  if (hasJSONC && hasJSON) {
    throw new Error(`Both ${serverJSONC} and ${serverJSON} exist. Resolve the duplicate OpenCode config first.`)
  }
  const server = hasJSONC ? serverJSONC : serverJSON
  return {
    server: await readConfig(server, hasJSONC || hasJSON ? undefined : "{\n}\n"),
    cli: await readConfig(path.join(configDir, "cli.json"), "{\n}\n"),
  }
}

async function readConfig(file, fallback) {
  let text = fallback
  let target = file
  if (await exists(file)) {
    const stat = await lstat(file)
    if (stat.isSymbolicLink()) {
      try {
        target = await realpath(file)
      } catch {
        throw new Error(`Config symlink is broken: ${file}`)
      }
    }
    const targetStat = await lstat(target)
    if (!targetStat.isFile()) throw new Error(`Config path is not a regular file: ${file}`)
    text = await readFile(target, "utf8")
  }
  const data = parseJSONC(text, file)
  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new Error(`${file} must contain a JSON object.`)
  }
  return {
    file,
    target,
    text,
    originalText: text,
    data,
    exists: await exists(file),
    mode: await fileMode(target),
  }
}

function parseJSONC(text, file) {
  const errors = []
  const data = parse(text, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length) {
    const first = errors[0]
    throw new Error(`Cannot parse ${file} as JSONC (error ${getParseErrorCode(first.error)} at offset ${first.offset}).`)
  }
  return data
}

async function printDryRun(configDir, configFiles) {
  console.log(`Integral ${PACKAGE.version} would be installed in ${configDir}`)
  console.log(`Persistent package: ${path.join(configDir, "integral", "releases")}`)
  console.log(`Server config: ${configFiles.server.file}${configFiles.server.exists ? " (preserved and merged)" : " (created)"}`)
  console.log(`TUI config: ${configFiles.cli.file}${configFiles.cli.exists ? " (preserved and merged)" : " (created)"}`)
  for (const [relative] of GLOBAL_FILES) console.log(`Managed resource: ${path.join(configDir, relative)}`)
  console.log("No files were changed.")
}

async function install(configDir, releaseRoot, configs) {
  const fingerprint = await sourceFingerprint()
  const releaseName = `${PACKAGE.version}-${fingerprint.slice(0, 12)}`
  const release = path.join(releaseRoot, releaseName)
  const current = path.join(configDir, "integral", "current")
  const currentBefore = await readCurrent(current)
  const activeRelease = currentBefore ? path.resolve(path.dirname(current), currentBefore) : undefined

  if (activeRelease === release && await verifyRelease(release)) {
    const check = await checkInstallation(configDir, configs, { quiet: true })
    if (check) {
      console.log(`Integral ${PACKAGE.version} is already installed and verified at ${configDir}.`)
      return
    }
  }

  let stagedRelease
  if (await exists(release)) {
    if (!(await verifyRelease(release))) {
      throw new Error(`Release directory exists but failed verification; it was left untouched: ${release}`)
    }
  } else {
    stagedRelease = await prepareRelease(releaseRoot, releaseName, fingerprint)
  }

  const backupRoot = path.join(configDir, ".integral-backups", backupTimestamp())
  const actions = []
  const warnings = []
  let switched = false
  try {
    await ensureGlobalLearn(configDir, backupRoot, actions)
    await installPublicResources(configDir, release, backupRoot, actions)
    await backupLegacyPluginLinks(configDir, backupRoot, actions)
    updateServerConfig(configs.server, configDir, warnings)
    updateCliConfig(configs.cli, configDir)
    await writeConfig(configs.server, backupRoot, actions)
    await writeConfig(configs.cli, backupRoot, actions)
    await activateRelease(current, releaseRoot, releaseName, currentBefore)
    switched = true
    if (stagedRelease) stagedRelease = undefined
    if (!(await verifyRelease(release))) throw new Error("The active release did not pass post-switch verification.")
    console.log(`Integral ${PACKAGE.version} installed and verified in ${configDir}.`)
    console.log(`Persistent release: ${release}`)
    console.log("Agent: installed · Commands: installed · Server plugin: configured · TUI plugin: configured")
    if (warnings.length) for (const warning of warnings) console.warn(`Warning: ${warning}`)
    if (await exists(backupRoot)) console.log(`Previous files and config snapshots are preserved in ${backupRoot}`)
    console.log("OpenCode watches configuration changes; use /reload only if components do not appear.")
    const verified = await checkInstallation(configDir, configs, { quiet: true })
    if (!verified) throw new Error("Post-install verification failed.")
  } catch (error) {
    if (switched) await restoreCurrent(current, currentBefore)
    const rollbackErrors = await rollback(actions)
    if (stagedRelease) await rm(stagedRelease, { recursive: true, force: true }).catch(() => {})
    if (rollbackErrors.length) {
      throw new Error(`${error.message}. Rollback was incomplete: ${rollbackErrors.join("; ")}. Backups are preserved in ${backupRoot}`)
    }
    throw error
  }
}

async function sourceFingerprint() {
  return hashFiles(PACKAGE_ROOT, ["package.json", ...ASSETS])
}

async function hashFiles(directory, paths) {
  const hash = createHash("sha256")
  for (const relative of [...paths].sort()) {
    const full = path.join(directory, relative)
    hash.update(relative)
    const stat = await lstat(full)
    if (stat.isDirectory()) {
      for (const file of await walk(full)) {
        const name = path.relative(directory, file)
        hash.update(name)
        hash.update(await readFile(file))
      }
    } else hash.update(await readFile(full))
  }
  return hash.digest("hex")
}

async function walk(directory) {
  const files = []
  for (const entry of await (await import("node:fs/promises")).readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Package assets must not contain symlinks: ${full}`)
    if (entry.isDirectory()) files.push(...await walk(full))
    else if (entry.isFile()) files.push(full)
  }
  return files.sort()
}

async function prepareRelease(releaseRoot, releaseName, sourceFingerprint) {
  const staging = path.join(releaseRoot, `.staging-${process.pid}-${randomBytes(5).toString("hex")}`)
  await mkdir(staging, { recursive: false })
  try {
    for (const item of ASSETS) {
      const source = path.join(PACKAGE_ROOT, item)
      if (!(await exists(source))) continue
      await cp(source, path.join(staging, item), { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false })
    }
    const releaseManifest = {
      name: PACKAGE.name,
      version: PACKAGE.version,
      sourceFingerprint,
      assetsFingerprint: await hashFiles(staging, ASSETS),
    }
    await writeFile(path.join(staging, "integral-release.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`, { flag: "wx", mode: 0o600 })
    if (!(await verifyRelease(staging, sourceFingerprint))) throw new Error("Staged package failed its integrity check.")
    const destination = path.join(releaseRoot, releaseName)
    await rename(staging, destination)
    return destination
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

async function verifyRelease(directory, expectedFingerprint) {
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, "integral-release.json"), "utf8"))
    if (manifest.name !== PACKAGE.name || !/^\d+\.\d+\.\d+/.test(manifest.version)) return false
    for (const relative of ASSETS) {
      const asset = path.join(directory, relative)
      if (ASSET_DIRECTORIES.has(relative)) {
        if (!(await isDirectory(asset))) return false
      } else if (!(await isRegularFile(asset))) return false
    }
    if (expectedFingerprint && manifest.sourceFingerprint !== expectedFingerprint) return false
    const assetFingerprint = await hashFiles(directory, ASSETS)
    if (manifest.assetsFingerprint !== assetFingerprint) return false
    const releaseName = `${manifest.version}-${manifest.sourceFingerprint.slice(0, 12)}`
    if (!path.basename(directory).startsWith(".staging-") && path.basename(directory) !== releaseName) return false
    return true
  } catch {
    return false
  }
}

async function ensureGlobalLearn(configDir, backupRoot, actions) {
  const file = path.join(configDir, "LEARN.md")
  if (await exists(file) || await isSymlink(file)) return
  const content = `# Memoria global de procedimiento

Preferencias generales y duraderas de colaboración. No guardar datos sensibles ni detalles técnicos de proyectos.

## Preferencias
`
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content, { flag: "wx", mode: 0o600 })
  actions.push({ kind: "created", file })
}

async function installPublicResources(configDir, release, backupRoot, actions) {
  for (const [relative, sourceRelative] of GLOBAL_FILES) {
    const destination = path.join(configDir, relative)
    const source = path.join(release, sourceRelative)
    await mkdir(path.dirname(destination), { recursive: true })

    let content = await readFile(source, "utf8")
    if (relative === "commands/integral-init.md" || relative === "commands/integral-learn.md") {
      content = content
        .replaceAll("__INTEGRAL_LEARN_HELPER_URL__", encodedFileURL(path.join(configDir, "integral", "current", "commands", "integral-learn-init.js")))
        .replaceAll("__INTEGRAL_CONFIG_DIR__", Buffer.from(configDir).toString("base64"))
    } else if (relative === "commands/integral-modelos.md") {
      content = content.replaceAll(
        "__INTEGRAL_MODELS_HELPER_URL__",
        encodedFileURL(path.join(configDir, "integral", "current", "commands", "integral-modelos-data.js")),
      )
    }

    if (await exists(destination) && !(await isSymlink(destination))) {
      if (await isDirectory(destination)) {
        throw new Error(`Cannot replace directory with an Integral resource: ${destination}`)
      }
      if (await readFile(destination, "utf8") === content) continue
    }

    const backup = await moveToBackup(destination, backupRoot)
    actions.push({ kind: "replaced", file: destination, backup })
    const mode = backup && !(await isSymlink(backup)) ? await fileMode(backup) : 0o644
    await atomicWrite(destination, content, mode)
  }
}

async function backupLegacyPluginLinks(configDir, backupRoot, actions) {
  for (const name of ["integral-model-switch", "integral-sidebar"]) {
    const file = path.join(configDir, "plugins", name)
    if (!(await isSymlink(file))) continue
    const backup = await moveToBackup(file, backupRoot)
    if (backup) actions.push({ kind: "removed", file, backup })
  }
}

function encodedFileURL(file) {
  return Buffer.from(pathToFileURL(file).href).toString("base64")
}

async function moveToBackup(file, backupRoot) {
  if (!(await exists(file)) && !(await isSymlink(file))) return undefined
  const backup = backupFilePath(file, backupRoot)
  await mkdir(path.dirname(backup), { recursive: true })
  await rename(file, backup)
  return backup
}

function updateServerConfig(config, configDir, warnings) {
  const learn = path.join(configDir, "LEARN.md")
  config.text = ensurePath(config, ["instructions"], [])
  config.text = appendArray(config.text, config.data, ["instructions"], learn)
  config.data = parseJSONC(config.text, config.file)
  config.text = appendArray(config.text, config.data, ["instructions"], ".opencode/LEARN.md")
  config.data = parseJSONC(config.text, config.file)

  config.text = ensurePath(config, ["agents"], {})
  config.data = parseJSONC(config.text, config.file)
  config.text = setPath(config.text, ["agents", "integral", "mode"], "primary")
  config.text = setPath(config.text, ["agents", "integral", "color"], "#14b8a6")
  config.data = parseJSONC(config.text, config.file)

  const serverPlugin = path.join(configDir, "integral", "current", "plugins", "integral-model-switch")
  config.text = ensureArrayEntry(config.text, config.data, ["plugins"], serverPlugin, [
    "./plugins/integral-model-switch",
  ])
  config.data = parseJSONC(config.text, config.file)
  if (config.data.experimental === false) {
    warnings.push("experimental is explicitly disabled; Integral's native task checklist will not be available.")
  } else if (config.data.experimental?.todo === false) {
    warnings.push("experimental.todo is explicitly disabled; Integral's native task checklist will not be available.")
  } else {
    config.text = ensurePath(config, ["experimental"], {})
    config.data = parseJSONC(config.text, config.file)
    if (!isPlainObject(config.data.experimental)) {
      throw new Error(`${config.file}: experimental must be an object or false.`)
    }
    config.text = setPath(config.text, ["experimental", "todo"], true)
    config.data = parseJSONC(config.text, config.file)
  }
}

function updateCliConfig(config, configDir) {
  if (!config.data.$schema) {
    config.text = setPath(config.text, ["$schema"], "https://opencode.ai/v2/cli.json")
    config.data = parseJSONC(config.text, config.file)
  }
  const pluginPath = path.join(configDir, "integral", "current", "plugins", "integral-sidebar")
  const plugins = config.data.plugins ?? []
  if (!Array.isArray(plugins)) throw new Error(`${config.file}: plugins must be an array.`)
  const index = plugins.findIndex((entry) =>
    pluginPackage(entry) === pluginPath || pluginPackage(entry) === "./plugins/integral-sidebar",
  )
  if (index === -1) {
    config.text = appendArray(config.text, config.data, ["plugins"], { package: pluginPath, options: { configDir } })
  } else if (typeof plugins[index] === "string") {
    config.text = setPath(config.text, ["plugins", index], { package: pluginPath, options: { configDir } })
  } else {
    config.text = setPath(config.text, ["plugins", index, "package"], pluginPath)
    config.data = parseJSONC(config.text, config.file)
    if (!isPlainObject(config.data.plugins[index].options)) {
      config.text = setPath(config.text, ["plugins", index, "options"], {})
    }
    config.text = setPath(config.text, ["plugins", index, "options", "configDir"], configDir)
  }
  config.data = parseJSONC(config.text, config.file)
}

function pluginPackage(entry) {
  return typeof entry === "string" ? entry : entry && typeof entry.package === "string" ? entry.package : undefined
}

function ensurePath(config, keyPath, value) {
  if (getPath(config.data, keyPath) !== undefined) {
    if (!Array.isArray(getPath(config.data, keyPath)) && !isPlainObject(getPath(config.data, keyPath))) {
      throw new Error(`${config.file}: ${keyPath.join(".")} must be an ${keyPath[0] === "instructions" || keyPath[0] === "plugins" ? "array" : "object"}.`)
    }
    return config.text
  }
  return setPath(config.text, keyPath, value)
}

function getPath(object, keys) {
  return keys.reduce((value, key) => value?.[key], object)
}

function setPath(text, keyPath, value) {
  return applyEdits(text, modify(text, keyPath, value, JSON_FORMAT))
}

function appendArray(text, data, keyPath, value) {
  let array = getPath(data, keyPath)
  if (array === undefined) {
    text = setPath(text, keyPath, [])
    data = parseJSONC(text, "<configuration>")
    array = getPath(data, keyPath)
  }
  if (!Array.isArray(array)) throw new Error(`${keyPath.join(".")} must be an array.`)
  if (array.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) return text
  return applyEdits(text, modify(text, [...keyPath, array.length], value, JSON_FORMAT))
}

function ensureArrayEntry(text, data, keyPath, value, aliases) {
  let entries = getPath(data, keyPath)
  if (entries === undefined) {
    text = setPath(text, keyPath, [])
    data = parseJSONC(text, "<configuration>")
    entries = getPath(data, keyPath)
  }
  if (!Array.isArray(entries)) throw new Error(`${keyPath.join(".")} must be an array.`)
  const matches = []
  entries.forEach((entry, index) => {
    if (entry === value || aliases.includes(pluginPackage(entry) ?? entry)) matches.push(index)
  })
  if (!matches.length) return appendArray(text, data, keyPath, value)
  const [keep, ...duplicates] = matches
  if (typeof entries[keep] === "string") {
    if (entries[keep] !== value) text = setPath(text, [...keyPath, keep], value)
  } else if (pluginPackage(entries[keep]) !== value) {
    text = setPath(text, [...keyPath, keep, "package"], value)
  }
  for (const index of duplicates.sort((a, b) => b - a)) {
    text = applyEdits(text, modify(text, [...keyPath, index], undefined, JSON_FORMAT))
  }
  return text
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

async function writeConfig(config, backupRoot, actions) {
  if (config.text === config.originalText) return
  const currentText = await exists(config.target) ? await readFile(config.target, "utf8") : undefined
  if (config.exists && currentText !== config.originalText) {
    throw new Error(`OpenCode config changed during installation; refusing to overwrite concurrent edits: ${config.file}`)
  }
  if (!config.exists && currentText !== undefined) {
    throw new Error(`OpenCode config was created during installation; refusing to overwrite it: ${config.file}`)
  }
  let backup
  if (config.exists && await exists(config.target)) {
    backup = backupFilePath(config.target, backupRoot)
    await mkdir(path.dirname(backup), { recursive: true })
    await copyFile(config.target, backup)
    await chmod(backup, config.mode)
  }
  await atomicWrite(config.target, config.text, config.mode)
  actions.push({
    kind: config.exists ? "config" : "created",
    file: config.target,
    backup,
    original: config.originalText,
    mode: config.mode,
  })
}

async function atomicWrite(file, content, mode) {
  const temporary = `${file}.integral-${process.pid}-${randomBytes(5).toString("hex")}`
  try {
    await writeFile(temporary, content, { flag: "wx", mode })
    await chmod(temporary, mode)
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

async function activateRelease(current, releaseRoot, releaseName, previousLink) {
  const temporary = path.join(path.dirname(current), `.current-${process.pid}-${randomBytes(5).toString("hex")}`)
  const linkTarget = process.platform === "win32"
    ? path.join(releaseRoot, releaseName)
    : path.join("releases", releaseName)
  await symlink(linkTarget, temporary, process.platform === "win32" ? "junction" : "dir")
  try {
    if (previousLink !== undefined) {
      if (!(await isSymlink(current))) throw new Error(`The active release path is not a symlink: ${current}`)
      await rename(temporary, current)
    } else {
      await rename(temporary, current)
    }
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

async function readCurrent(current) {
  if (!(await exists(current)) && !(await isSymlink(current))) return undefined
  if (!(await isSymlink(current))) throw new Error(`Refusing to replace non-symlink active path: ${current}`)
  return readlink(current)
}

async function restoreCurrent(current, previousLink) {
  if (previousLink === undefined) {
    await rm(current, { recursive: true, force: true })
    return
  }
  const temporary = `${current}.rollback-${randomBytes(5).toString("hex")}`
  await symlink(previousLink, temporary, process.platform === "win32" ? "junction" : "dir")
  await rename(temporary, current)
}

async function rollback(actions) {
  const errors = []
  for (const action of actions.reverse()) {
    try {
      if (action.kind === "created") await rm(action.file, { force: true })
      else if (action.kind === "replaced") {
        await rm(action.file, { recursive: true, force: true })
        if (action.backup) await rename(action.backup, action.file)
      } else if (action.kind === "removed") {
        if (action.backup) await rename(action.backup, action.file)
      } else if (action.kind === "config") await atomicWrite(action.file, action.original, action.mode)
    } catch (error) {
      errors.push(`${action.file}: ${error.message}`)
    }
  }
  return errors
}

async function checkInstallation(configDir, configs, { quiet = false } = {}) {
  const current = path.join(configDir, "integral", "current")
  let release
  try {
    if (!(await isSymlink(current))) throw new Error("active release pointer is missing")
    release = path.resolve(path.dirname(current), await readlink(current))
    if (!(await verifyRelease(release))) throw new Error("active release files or dependencies are incomplete")
    for (const [relative, sourceRelative] of GLOBAL_FILES) {
      const file = path.join(configDir, relative)
      if (!(await exists(file)) || await isSymlink(file)) throw new Error(`managed resource is missing or not a regular file: ${relative}`)
      let expected = await readFile(path.join(release, sourceRelative), "utf8")
      if (relative === "commands/integral-init.md" || relative === "commands/integral-learn.md") {
        expected = expected
          .replaceAll("__INTEGRAL_LEARN_HELPER_URL__", encodedFileURL(path.join(configDir, "integral", "current", "commands", "integral-learn-init.js")))
          .replaceAll("__INTEGRAL_CONFIG_DIR__", Buffer.from(configDir).toString("base64"))
      } else if (relative === "commands/integral-modelos.md") {
        expected = expected.replaceAll(
          "__INTEGRAL_MODELS_HELPER_URL__",
          encodedFileURL(path.join(configDir, "integral", "current", "commands", "integral-modelos-data.js")),
        )
      }
      if (await readFile(file, "utf8") !== expected) throw new Error(`managed resource was modified: ${relative}`)
    }
    const server = configs.server.data
    const cli = configs.cli.data
    if (getPath(server, ["agents", "integral", "mode"]) !== "primary") throw new Error("Integral agent is not configured as primary")
    const serverPlugin = path.join(configDir, "integral", "current", "plugins", "integral-model-switch")
    const cliPlugin = path.join(configDir, "integral", "current", "plugins", "integral-sidebar")
    if (!server.plugins?.some((entry) => pluginPackage(entry) === serverPlugin)) throw new Error("server plugin is not configured")
    const tuiPlugin = cli.plugins?.find((entry) => pluginPackage(entry) === cliPlugin)
    if (!tuiPlugin) throw new Error("TUI plugin is not configured")
    if (typeof tuiPlugin !== "string" && tuiPlugin.options?.configDir !== configDir) {
      throw new Error("TUI plugin has an incorrect config directory.")
    }
    if (!Array.isArray(server.instructions) || !server.instructions.includes(path.join(configDir, "LEARN.md"))) {
      throw new Error("global LEARN instructions are not configured")
    }
    if (server.experimental !== false && server.experimental?.todo !== false && server.experimental?.todo !== true) {
      throw new Error("native task checklist is not enabled")
    }
    if (!quiet) {
      const warning = server.experimental === false || server.experimental?.todo === false
      console.log(`Integral release ${JSON.parse(await readFile(path.join(release, "integral-release.json"), "utf8")).version}: package verified.`)
      console.log("Agent and commands installed; server and TUI plugins registered; configuration parsed and verified.")
      if (warning) console.warn("Warning: experimental.todo is disabled; the native checklist is unavailable.")
      console.log(`Location: ${configDir}`)
    }
    return true
  } catch (error) {
    if (!quiet) console.error(`Integral is not fully installed: ${error.message}`)
    return false
  }
}

async function acquireLock(configDir) {
  const lockDir = path.join(configDir, LOCK_NAME)
  try {
    await mkdir(lockDir)
  } catch (error) {
    if (error.code !== "EEXIST") throw error
    let owner
    try {
      owner = JSON.parse(await readFile(path.join(lockDir, "owner.json"), "utf8"))
    } catch {}
    if (owner?.pid && owner.host === os.hostname() && isProcessAlive(owner.pid)) {
      throw new Error(`Another Integral install is running (PID ${owner.pid}).`)
    }
    if (!owner) {
      const lockStat = await stat(lockDir)
      if (Date.now() - lockStat.mtimeMs < 60_000) {
        throw new Error("Another Integral install is initializing its lock. Retry shortly.")
      }
    }
    const stale = `${lockDir}.stale-${backupTimestamp()}`
    await rename(lockDir, stale).catch(() => {
      throw new Error(`An installer lock exists at ${lockDir}; inspect it before retrying.`)
    })
    await mkdir(lockDir)
  }
  await writeFile(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid, host: os.hostname() }), { flag: "wx" })
  return { release: () => rm(lockDir, { recursive: true, force: true }) }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === "EPERM"
  }
}

function backupFilePath(file, backupRoot) {
  const configRoot = path.dirname(path.dirname(backupRoot))
  const relative = path.relative(configRoot, file)
  const safeRelative = relative.startsWith("..") || path.isAbsolute(relative)
    ? path.join("external", createHash("sha1").update(file).digest("hex").slice(0, 10), path.basename(file))
    : relative
  return path.join(backupRoot, "files", safeRelative)
}

function backupTimestamp() {
  return `${new Date().toISOString().replaceAll(/[-:.TZ]/g, "")}-${randomBytes(3).toString("hex")}`
}

function isWithin(parent, target) {
  const relative = path.relative(parent, target)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

async function fileMode(file) {
  try {
    return (await lstat(file)).mode & 0o777
  } catch {
    return 0o600
  }
}

async function exists(file) {
  try {
    await lstat(file)
    return true
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

async function isSymlink(file) {
  try {
    return (await lstat(file)).isSymbolicLink()
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

async function isDirectory(file) {
  try {
    return (await lstat(file)).isDirectory()
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

async function isRegularFile(file) {
  try {
    return (await lstat(file)).isFile()
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

function printHelp() {
  console.log(`Integral OpenCode installer ${PACKAGE.version}

Usage:
  npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode [options]

Options:
  --config-dir <path>  Use a specific OpenCode config directory
  --dry-run            Show planned changes without writing or downloading dependencies
  --check              Verify an existing Integral installation
  --version            Print the installer version
  --help               Show this help
`)
}
