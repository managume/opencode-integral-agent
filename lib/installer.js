import { createHash, randomBytes } from "node:crypto"
import {
  chmod,
  copyFile,
  lstat,
  stat,
  mkdir,
  readFile,
  readlink,
  realpath,
  rename,
  rmdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import jsoncParser from "jsonc-parser"

const { applyEdits, modify, parse, printParseErrorCode } = jsoncParser

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PACKAGE = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "package.json"), "utf8"))
const ASSETS = [
  "agents/integral.md",
  "commands/integral-start.md",
  "commands/integral-audit.md",
  "commands/integral-release.md",
  "commands/integral-doctor.md",
  "commands/integral-learn-init.js",
  "commands/integral-modelos-data.js",
  "plugins/integral-model-switch/index.js",
  "plugins/integral-model-switch/package.json",
]
const GLOBAL_FILES = [
  ["agents/integral.md", "agents/integral.md"],
  ["commands/integral-start.md", "commands/integral-start.md"],
  ["commands/integral-audit.md", "commands/integral-audit.md"],
  ["commands/integral-release.md", "commands/integral-release.md"],
  ["commands/integral-doctor.md", "commands/integral-doctor.md"],
]
const LEGACY_PUBLIC_RESOURCES = [
  "commands/integral-init.md",
  "commands/integral-learn.md",
  "commands/integral-modelos.md",
]
const LEGACY_PLUGIN_ENTRIES = ["./plugins/integral-sidebar"]
const INSTALL_STATE_VERSION = 1
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

  if (options.uninstall) {
    if (!(await exists(configDir))) {
      console.log(`Integral is not installed in ${configDir}.`)
      return
    }
    const lock = await acquireLock(configDir)
    try {
      const configs = await inspectConfigFiles(configDir)
      if (!(await hasIntegralInstallation(configDir, configs))) {
        console.log(`Integral is not installed in ${configDir}.`)
        return
      }
      await uninstall(configDir, configs)
    } finally {
      await lock.release()
    }
    return
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
  const result = { configDir: undefined, check: false, dryRun: false, uninstall: false, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--config-dir") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("--config-dir requires a path.")
      result.configDir = argv[++i]
    } else if (arg === "--check") result.check = true
    else if (arg === "--dry-run") result.dryRun = true
    else if (arg === "--uninstall") result.uninstall = true
    else if (arg === "--help" || arg === "-h") result.help = true
    else if (arg === "--version" || arg === "-v") result.version = true
    else throw new Error(`Unknown option: ${arg}. Use --help to see supported options.`)
  }
  if ([result.check, result.dryRun, result.uninstall].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --check, --dry-run, or --uninstall.")
  }
  if (result.version && (result.check || result.dryRun || result.uninstall || result.configDir)) {
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
    throw new Error(`Cannot parse ${file} as JSONC (${printParseErrorCode(first.error)} at offset ${first.offset}).`)
  }
  return data
}

async function printDryRun(configDir, configFiles) {
  console.log(`Integral ${PACKAGE.version} would be installed in ${configDir}`)
  console.log(`Persistent package: ${path.join(configDir, "integral", "releases")}`)
  console.log(`Server config: ${configFiles.server.file}${configFiles.server.exists ? " (preserved and merged)" : " (created)"}`)
  console.log(`CLI config: ${configFiles.cli.file}${configFiles.cli.exists ? " (preserved)" : " (unchanged)"}`)
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
  const ownership = await readInstallOwnership(configDir, configs, currentBefore)

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
    await backupLegacyResources(configDir, backupRoot, actions)
    await installPublicResources(configDir, release, backupRoot, actions)
    updateServerConfig(configs.server, configDir, warnings)
    updateCliConfig(configs.cli, configDir)
    ownership.serverPlugins.installed = matchingEntries(configs.server.data.plugins, isIntegralServerPlugin)
    ownership.cliSidebar.installed = matchingEntries(configs.cli.data.plugins, isIntegralSidebarPlugin)
    await writeConfig(configs.server, backupRoot, actions)
    await writeConfig(configs.cli, backupRoot, actions)
    await writeInstallOwnership(configDir, ownership, backupRoot, actions)
    await activateRelease(current, releaseRoot, releaseName, currentBefore)
    switched = true
    if (stagedRelease) stagedRelease = undefined
    if (!(await verifyRelease(release))) throw new Error("The active release did not pass post-switch verification.")
    const verified = await checkInstallation(configDir, configs, { quiet: true })
    if (!verified) {
      await checkInstallation(configDir, configs)
      throw new Error("Post-install verification failed.")
    }
    console.log(`Integral ${PACKAGE.version} installed and verified in ${configDir}.`)
    console.log(`Persistent release: ${release}`)
    console.log("Agent and four commands installed · Model-switch plugin configured")
    if (warnings.length) for (const warning of warnings) console.warn(`Warning: ${warning}`)
    if (await exists(backupRoot)) console.log(`Previous files and config snapshots are preserved in ${backupRoot}`)
    console.log("OpenCode watches configuration changes; use /reload only if the agent or commands do not appear.")
  } catch (error) {
    const rollbackErrors = await rollbackInstallation({
      current,
      previousLink: currentBefore,
      switched,
      actions,
    })
    if (stagedRelease) await rm(stagedRelease, { recursive: true, force: true }).catch(() => {})
    if (rollbackErrors.length) {
      throw new Error(`${error.message}. Rollback was incomplete: ${rollbackErrors.join("; ")}. Backups are preserved in ${backupRoot}`)
    }
    throw error
  }
}

async function uninstall(configDir, configs) {
  const current = path.join(configDir, "integral", "current")
  const currentBefore = await readCurrent(current)
  const ownership = await readInstallOwnership(configDir, configs, currentBefore)
  const backupRoot = path.join(configDir, ".integral-backups", `uninstall-${backupTimestamp()}`)
  const actions = []
  try {
    const warnings = []
    const globalLearn = path.join(configDir, "LEARN.md")
    const preserveEditedLearn = ownership.known && ownership.learnCreated &&
      await exists(globalLearn) && await readFile(globalLearn, "utf8") !== globalLearnTemplate()
    removeServerRegistration(configs.server, configDir, ownership, warnings, preserveEditedLearn)
    if (ownership.known) {
      restoreManagedEntries(configs.cli, ["plugins"], isIntegralSidebarPlugin, ownership.cliSidebar, warnings)
    } else {
      removeMatchingEntries(configs.cli, ["plugins"], isIntegralSidebarPlugin)
    }
    await writeConfig(configs.server, backupRoot, actions)
    await writeConfig(configs.cli, backupRoot, actions)

    for (const [relative] of GLOBAL_FILES) {
      const file = path.join(configDir, relative)
      const backup = await moveToBackup(file, backupRoot)
      if (backup) actions.push({ kind: "removed", file, backup })
    }
    await backupLegacyResources(configDir, backupRoot, actions)
    await backupCreatedGlobalLearn(configDir, ownership, backupRoot, actions, warnings)

    const currentBackup = await moveToBackup(current, backupRoot)
    if (currentBackup) actions.push({ kind: "removed", file: current, backup: currentBackup })
    const stateFile = path.join(configDir, "integral", "install-state.json")
    const stateBackup = await moveToBackup(stateFile, backupRoot)
    if (stateBackup) actions.push({ kind: "removed", file: stateFile, backup: stateBackup })
    const releases = path.join(configDir, "integral", "releases")
    const releasesBackup = await moveToBackup(releases, backupRoot)
    if (releasesBackup) actions.push({ kind: "removed", file: releases, backup: releasesBackup })
    await rmdir(path.join(configDir, "integral")).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error
    })

    console.log(`Integral was uninstalled from ${configDir}.`)
    if (await exists(backupRoot)) console.log(`Removed resources and config snapshots were preserved in ${backupRoot}`)
    console.log("LEARN memories, project checkpoints, unrelated plugins, and unrelated configuration were preserved.")
    for (const warning of warnings) console.warn(`Preserved: ${warning}`)
  } catch (error) {
    const rollbackErrors = await rollback(actions)
    if (rollbackErrors.length) {
      throw new Error(`${error.message}. Uninstall rollback was incomplete: ${rollbackErrors.join("; ")}. Backups are preserved in ${backupRoot}`)
    }
    throw error
  }
}

async function hasIntegralInstallation(configDir, configs) {
  const candidates = [
    path.join(configDir, "integral", "current"),
    path.join(configDir, "integral", "install-state.json"),
    path.join(configDir, "agents", "integral.md"),
    ...GLOBAL_FILES.map(([relative]) => path.join(configDir, relative)),
    ...LEGACY_PUBLIC_RESOURCES.map((relative) => path.join(configDir, relative)),
    path.join(configDir, "commands", "integral-learn-init.py"),
    path.join(configDir, "commands", "integral-modelos-data.py"),
    path.join(configDir, "plugins", "integral-model-switch"),
    path.join(configDir, "plugins", "integral-model-switch.js"),
    path.join(configDir, "plugins", "integral-sidebar"),
  ]
  for (const candidate of candidates) if (await exists(candidate) || await isSymlink(candidate)) return true
  const serverPlugin = path.join(configDir, "integral", "current", "plugins", "integral-model-switch")
  const cliSidebar = path.join(configDir, "integral", "current", "plugins", "integral-sidebar")
  return Boolean(
    configs.server.data.plugins?.some((entry) =>
      pluginPackage(entry) === serverPlugin || pluginPackage(entry) === "./plugins/integral-model-switch",
    ) ||
    configs.cli.data.plugins?.some((entry) =>
      pluginPackage(entry) === cliSidebar || LEGACY_PLUGIN_ENTRIES.includes(pluginPackage(entry)),
    )
  )
}

function removeServerRegistration(config, configDir, ownership, warnings, preserveEditedLearn) {
  if (ownership.known) {
    restoreManagedEntries(config, ["plugins"], isIntegralServerPlugin, ownership.serverPlugins, warnings)
    restoreOwnedValue(config, ["agents", "integral", "mode"], ownership.agent.mode, "primary", warnings)
    restoreOwnedValue(config, ["agents", "integral", "color"], ownership.agent.color, "#14b8a6", warnings)
    const integralAgent = getPath(config.data, ["agents", "integral"])
    if (!ownership.agent.parentPresent && isPlainObject(integralAgent) && Object.keys(integralAgent).length === 0) {
      config.text = setPath(config.text, ["agents", "integral"], undefined)
      config.data = parseJSONC(config.text, config.file)
    }
    if (!ownership.agentsParentPresent && isPlainObject(config.data.agents) && Object.keys(config.data.agents).length === 0) {
      config.text = setPath(config.text, ["agents"], undefined)
      config.data = parseJSONC(config.text, config.file)
    }

    if (!ownership.instructions.global && !preserveEditedLearn) removeInstruction(config, path.join(configDir, "LEARN.md"))
    if (!ownership.instructions.project) removeInstruction(config, ".opencode/LEARN.md")
    if (!ownership.instructions.parentPresent && config.data.instructions?.length === 0) {
      config.text = setPath(config.text, ["instructions"], undefined)
      config.data = parseJSONC(config.text, config.file)
    }
    if (!ownership.serverPlugins.parentPresent && config.data.plugins?.length === 0) {
      config.text = setPath(config.text, ["plugins"], undefined)
      config.data = parseJSONC(config.text, config.file)
    }
    if (ownership.experimental.parentPresent) {
      if (ownership.experimental.todoInstalled) {
        restoreOwnedValue(config, ["experimental", "todo"], ownership.experimental.todo, true, warnings)
      }
    } else if (ownership.experimental.todoInstalled && getPath(config.data, ["experimental", "todo"]) === true) {
      config.text = setPath(config.text, ["experimental", "todo"], undefined)
      config.data = parseJSONC(config.text, config.file)
      if (Object.keys(getPath(config.data, ["experimental"]) ?? {}).length === 0) {
        config.text = setPath(config.text, ["experimental"], undefined)
        config.data = parseJSONC(config.text, config.file)
      }
    }
  } else {
    removeMatchingEntries(config, ["plugins"], isIntegralServerPlugin)
    warnings.push("this installation predates the ownership record; existing agent settings, memory instructions, and checklist settings were left untouched")
  }
}

function isIntegralServerPlugin(entry) {
  const configured = pluginPackage(entry)
  return configured === "./plugins/integral-model-switch" ||
    /[\\/]integral[\\/]current[\\/]plugins[\\/]integral-model-switch$/.test(configured ?? "")
}

function isIntegralSidebarPlugin(entry) {
  const configured = pluginPackage(entry)
  return LEGACY_PLUGIN_ENTRIES.includes(configured) ||
    /[\\/]integral[\\/]current[\\/]plugins[\\/]integral-sidebar$/.test(configured ?? "")
}

function matchingEntries(entries, predicate) {
  return Array.isArray(entries)
    ? entries.flatMap((entry, index) => predicate(entry) ? [{ index, entry }] : [])
    : []
}

function removeMatchingEntries(config, keyPath, predicate) {
  const entries = getPath(config.data, keyPath)
  if (!Array.isArray(entries)) return
  const filtered = entries.filter((entry) => !predicate(entry))
  if (filtered.length !== entries.length) {
    config.text = setPath(config.text, keyPath, filtered)
    config.data = parseJSONC(config.text, config.file)
  }
}

function restoreManagedEntries(config, keyPath, predicate, ownership, warnings) {
  const current = getPath(config.data, keyPath) ?? []
  if (!Array.isArray(current)) throw new Error(`${config.file}: ${keyPath.join(".")} must be an array.`)
  const currentMatches = matchingEntries(current, predicate)
  const installed = ownership.installed.map(({ entry }) => entry)
  const actual = currentMatches.map(({ entry }) => entry)
  if (JSON.stringify(actual) !== JSON.stringify(installed)) {
    if (actual.length || installed.length) warnings.push(`${keyPath.join(".")} Integral entries were changed after installation`)
    return
  }

  const filtered = current.filter((entry) => !predicate(entry))
  const original = ownership.original
  if (original.length) {
    const position = Math.min(original[0].index, filtered.length)
    filtered.splice(position, 0, ...original.map(({ entry }) => entry))
  }
  if (!ownership.parentPresent && filtered.length === 0) {
    config.text = setPath(config.text, keyPath, undefined)
  } else {
    config.text = setPath(config.text, keyPath, filtered)
  }
  config.data = parseJSONC(config.text, config.file)
}

function restoreOwnedValue(config, keyPath, original, installedValue, warnings) {
  if (getPath(config.data, keyPath) !== installedValue) {
    warnings.push(`${keyPath.join(".")} was changed after installation`)
    return
  }
  const value = original.present ? original.value : undefined
  config.text = setPath(config.text, keyPath, value)
  config.data = parseJSONC(config.text, config.file)
}

function removeInstruction(config, instruction) {
  const instructions = config.data.instructions
  if (!Array.isArray(instructions) || !instructions.includes(instruction)) return
  config.text = setPath(config.text, ["instructions"], instructions.filter((entry) => entry !== instruction))
  config.data = parseJSONC(config.text, config.file)
}

async function sourceFingerprint() {
  return hashFiles(PACKAGE_ROOT, ["package.json", ...ASSETS])
}

async function readInstallOwnership(configDir, configs, currentBefore) {
  const file = path.join(configDir, "integral", "install-state.json")
  if (await exists(file)) {
    let state
    try {
      state = JSON.parse(await readFile(file, "utf8"))
    } catch (error) {
      throw new Error(`Cannot read Integral install ownership state at ${file}: ${error.message}`)
    }
    if (state.version !== INSTALL_STATE_VERSION || !isValidOwnership(state.ownership)) {
      throw new Error(`Unsupported Integral install ownership state at ${file}.`)
    }
    return { ...state.ownership, known: state.ownership.known === true }
  }
  if (currentBefore !== undefined) return { known: false, learnCreated: false }

  const server = configs.server.data
  const agent = getPath(server, ["agents", "integral"])
  const instructions = Array.isArray(server.instructions) ? server.instructions : []
  const experimental = server.experimental
  return {
    known: true,
    learnCreated: !(await exists(path.join(configDir, "LEARN.md"))),
    agent: {
      parentPresent: isPlainObject(agent),
      mode: captureOwn(agent, "mode"),
      color: captureOwn(agent, "color"),
    },
    instructions: {
      parentPresent: Array.isArray(server.instructions),
      global: instructions.includes(path.join(configDir, "LEARN.md")),
      project: instructions.includes(".opencode/LEARN.md"),
    },
    agentsParentPresent: isPlainObject(server.agents),
    experimental: {
      parentPresent: isPlainObject(experimental),
      todo: captureOwn(experimental, "todo"),
      todoInstalled: experimental !== false && experimental?.todo === undefined,
    },
    serverPlugins: {
      parentPresent: Object.hasOwn(server, "plugins"),
      original: matchingEntries(server.plugins, isIntegralServerPlugin),
      installed: [],
    },
    cliSidebar: {
      parentPresent: Object.hasOwn(configs.cli.data, "plugins"),
      original: matchingEntries(configs.cli.data.plugins, isIntegralSidebarPlugin),
      installed: [],
    },
  }
}

function isValidOwnership(value) {
  if (!isPlainObject(value) || typeof value.known !== "boolean") return false
  if (!value.known) return true
  const validOwnValue = (entry) => isPlainObject(entry) &&
    typeof entry.present === "boolean" &&
    (!entry.present || Object.hasOwn(entry, "value"))
  return typeof value.learnCreated === "boolean" &&
    isPlainObject(value.agent) &&
    typeof value.agent.parentPresent === "boolean" &&
    validOwnValue(value.agent.mode) &&
    validOwnValue(value.agent.color) &&
    typeof value.agentsParentPresent === "boolean" &&
    validManagedEntries(value.serverPlugins) &&
    validManagedEntries(value.cliSidebar) &&
    isPlainObject(value.instructions) &&
    typeof value.instructions.parentPresent === "boolean" &&
    typeof value.instructions.global === "boolean" &&
    typeof value.instructions.project === "boolean" &&
    isPlainObject(value.experimental) &&
    typeof value.experimental.parentPresent === "boolean" &&
    typeof value.experimental.todoInstalled === "boolean" &&
    validOwnValue(value.experimental.todo)
}

function validManagedEntries(value) {
  return isPlainObject(value) &&
    typeof value.parentPresent === "boolean" &&
    Array.isArray(value.original) &&
    Array.isArray(value.installed) &&
    [...value.original, ...value.installed].every((item) =>
      isPlainObject(item) && Number.isInteger(item.index) && item.index >= 0 && Object.hasOwn(item, "entry"),
    )
}

function captureOwn(object, key) {
  return isPlainObject(object) && Object.hasOwn(object, key)
    ? { present: true, value: object[key] }
    : { present: false }
}

async function writeInstallOwnership(configDir, ownership, backupRoot, actions) {
  const file = path.join(configDir, "integral", "install-state.json")
  const content = `${JSON.stringify({ version: INSTALL_STATE_VERSION, ownership }, null, 2)}\n`
  if (await exists(file) && await readFile(file, "utf8") === content) return
  const backup = await moveToBackup(file, backupRoot)
  if (backup) {
    const mode = await fileMode(backup)
    actions.push({ kind: "replaced", file, backup, installedContent: content })
    await atomicWrite(file, content, mode)
  } else {
    await writeFile(file, content, { flag: "wx", mode: 0o600 })
    actions.push({ kind: "created", file, installedContent: content })
  }
}

async function hashFiles(directory, paths) {
  const hash = createHash("sha256")
  for (const relative of [...paths].sort()) {
    const full = path.join(directory, relative)
    hash.update(relative)
    hash.update(await readFile(full))
  }
  return hash.digest("hex")
}

async function prepareRelease(releaseRoot, releaseName, sourceFingerprint) {
  const staging = path.join(releaseRoot, `.staging-${process.pid}-${randomBytes(5).toString("hex")}`)
  await mkdir(staging, { recursive: false })
  try {
    for (const item of ASSETS) {
      const source = path.join(PACKAGE_ROOT, item)
      if (!(await isRegularFile(source))) throw new Error(`Required package asset is missing: ${item}`)
      const destination = path.join(staging, item)
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(source, destination, fsConstants.COPYFILE_EXCL)
    }
    await writeFile(path.join(staging, "package.json"), '{"type":"module"}\n', { flag: "wx", mode: 0o600 })
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
    for (const relative of ASSETS) if (!(await isRegularFile(path.join(directory, relative)))) return false
    const releasePackage = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"))
    if (releasePackage.type !== "module") return false
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
  const content = globalLearnTemplate()
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content, { flag: "wx", mode: 0o600 })
  actions.push({ kind: "created", file, installedContent: content })
}

function globalLearnTemplate() {
  return `# Memoria global de procedimiento

## Preferencias
`
}

async function backupCreatedGlobalLearn(configDir, ownership, backupRoot, actions, warnings) {
  if (!ownership.known || !ownership.learnCreated) return
  const file = path.join(configDir, "LEARN.md")
  if (!(await exists(file))) return
  if (await readFile(file, "utf8") !== globalLearnTemplate()) {
    warnings.push("global LEARN.md was edited after Integral created it; it was retained")
    return
  }
  const backup = await moveToBackup(file, backupRoot)
  if (backup) actions.push({ kind: "removed", file, backup })
}

async function installPublicResources(configDir, release, backupRoot, actions) {
  for (const [relative, sourceRelative] of GLOBAL_FILES) {
    const destination = path.join(configDir, relative)
    const source = path.join(release, sourceRelative)
    await mkdir(path.dirname(destination), { recursive: true })

    const content = await readFile(source, "utf8")

    if (await exists(destination) && !(await isSymlink(destination))) {
      if (await isDirectory(destination)) {
        throw new Error(`Cannot replace directory with an Integral resource: ${destination}`)
      }
      if (await readFile(destination, "utf8") === content) continue
    }

    const backup = await moveToBackup(destination, backupRoot)
    const mode = backup && !(await isSymlink(backup)) ? await fileMode(backup) : 0o644
    actions.push({ kind: "replaced", file: destination, backup, installedContent: content })
    await atomicWrite(destination, content, mode)
  }
}

async function backupLegacyResources(configDir, backupRoot, actions) {
  for (const relative of [
    ...LEGACY_PUBLIC_RESOURCES,
    "commands/integral-learn-init.py",
    "commands/integral-modelos-data.py",
    "plugins/integral-model-switch",
    "plugins/integral-sidebar",
    "plugins/integral-model-switch.js",
  ]) {
    const file = path.join(configDir, relative)
    const backup = await moveToBackup(file, backupRoot)
    if (backup) actions.push({ kind: "removed", file, backup })
  }
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
  const plugins = config.data.plugins ?? []
  if (!Array.isArray(plugins)) throw new Error(`${config.file}: plugins must be an array.`)
  const matches = plugins.flatMap((entry, index) =>
    pluginPackage(entry) === path.join(configDir, "integral", "current", "plugins", "integral-sidebar") ||
      LEGACY_PLUGIN_ENTRIES.includes(pluginPackage(entry))
      ? [index]
      : [],
  )
  if (matches.length) {
    const migrated = plugins.filter((_entry, index) => !matches.includes(index))
    config.text = setPath(config.text, ["plugins"], migrated)
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
    const configured = pluginPackage(entry) ?? entry
    if (configured === value || aliases.includes(configured)) matches.push(index)
  })
  if (!matches.length) return appendArray(text, data, keyPath, value)
  const keep = matches.find((index) => isPlainObject(entries[index])) ?? matches[0]
  const duplicates = matches.filter((index) => index !== keep)
  const migrated = entries
    .map((entry, index) => {
      if (index !== keep) return entry
      return isPlainObject(entry)
        ? { ...entry, package: value }
        : value
    })
    .filter((_entry, index) => !duplicates.includes(index))
  return setPath(text, keyPath, migrated)
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
    installedContent: config.text,
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
      if (action.kind === "created") {
        if (await exists(action.file)) {
          const current = await readFile(action.file, "utf8")
          if (current !== action.installedContent) throw new Error("file changed after installation; preserving it")
          await rm(action.file)
        }
      }
      else if (action.kind === "replaced") {
        if (await exists(action.file) || await isSymlink(action.file)) {
          const current = await readFile(action.file, "utf8")
          if (current !== action.installedContent) throw new Error("file changed after installation; preserving it and its backup")
          await rm(action.file)
        }
        if (action.backup) await rename(action.backup, action.file)
      } else if (action.kind === "removed") {
        if (await exists(action.file) || await isSymlink(action.file)) {
          throw new Error("path was recreated after migration; preserving it and the backup")
        }
        if (action.backup) await rename(action.backup, action.file)
      } else if (action.kind === "config") {
        const current = await readFile(action.file, "utf8")
        if (current !== action.installedContent) throw new Error("configuration changed after installation; preserving it and the backup")
        await atomicWrite(action.file, action.original, action.mode)
      }
    } catch (error) {
      errors.push(`${action.file}: ${error.message}`)
    }
  }
  return errors
}

export async function rollbackInstallation({
  current,
  previousLink,
  switched,
  actions,
  restore = restoreCurrent,
}) {
  const errors = []
  if (switched) {
    try {
      await restore(current, previousLink)
    } catch (error) {
      errors.push(`${current}: ${error.message}`)
    }
  }
  errors.push(...await rollback(actions))
  return errors
}

async function checkInstallation(configDir, configs, { quiet = false } = {}) {
  const current = path.join(configDir, "integral", "current")
  let release
  try {
    if (!(await isSymlink(current))) throw new Error("active release pointer is missing")
    release = path.resolve(path.dirname(current), await readlink(current))
    if (!(await verifyRelease(release))) throw new Error("active release files or dependencies are incomplete")
    await readInstallOwnership(configDir, configs, await readlink(current))
    for (const [relative, sourceRelative] of GLOBAL_FILES) {
      const file = path.join(configDir, relative)
      if (!(await exists(file)) || await isSymlink(file)) throw new Error(`managed resource is missing or not a regular file: ${relative}`)
      const expected = await readFile(path.join(release, sourceRelative), "utf8")
      if (await readFile(file, "utf8") !== expected) throw new Error(`managed resource was modified: ${relative}`)
    }
    for (const relative of LEGACY_PUBLIC_RESOURCES) {
      const file = path.join(configDir, relative)
      if (await exists(file) || await isSymlink(file)) throw new Error(`legacy Integral command is still installed: ${relative}`)
    }
    const server = configs.server.data
    const cli = configs.cli.data
    if (getPath(server, ["agents", "integral", "mode"]) !== "primary") throw new Error("Integral agent is not configured as primary")
    const serverPlugin = path.join(configDir, "integral", "current", "plugins", "integral-model-switch")
    if (server.plugins?.filter((entry) => pluginPackage(entry) === serverPlugin).length !== 1) {
      throw new Error("server plugin is missing or configured more than once")
    }
    if (cli.plugins?.some((entry) =>
      pluginPackage(entry) === path.join(configDir, "integral", "current", "plugins", "integral-sidebar") ||
      LEGACY_PLUGIN_ENTRIES.includes(pluginPackage(entry)),
    )) {
      throw new Error("removed Integral sidebar plugin is still configured")
    }
    if (!Array.isArray(server.instructions) ||
      !server.instructions.includes(path.join(configDir, "LEARN.md")) ||
      !server.instructions.includes(".opencode/LEARN.md")) {
      throw new Error("global or project LEARN instructions are not configured")
    }
    try {
      await readFile(path.join(configDir, "LEARN.md"), "utf8")
    } catch {
      throw new Error("global LEARN.md is missing or unreadable")
    }
    if (server.experimental !== false && server.experimental?.todo !== false && server.experimental?.todo !== true) {
      throw new Error("native task checklist is not enabled")
    }
    if (!quiet) {
      const warning = server.experimental === false || server.experimental?.todo === false
      console.log(`Integral release ${JSON.parse(await readFile(path.join(release, "integral-release.json"), "utf8")).version}: package verified.`)
      console.log("Agent and four commands installed; model-switch plugin registered; configuration parsed and verified.")
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
  --uninstall          Remove Integral and preserve removed files in a backup
  --version            Print the installer version
  --help               Show this help
`)
}
