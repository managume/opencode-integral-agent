import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import jsoncParser from "jsonc-parser"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const agent = await readFile(path.join(root, "agents/integral.md"), "utf8")
const init = await readFile(path.join(root, "commands/integral-init.md"), "utf8")
const readme = await readFile(path.join(root, "README.md"), "utf8")

test("Integral instructions require persistent, verified completion", () => {
  for (const phrase of [
    "Do not voluntarily end a turn",
    "task checklist",
    "Resume before replanning",
    "`.opencode/checkpoints/integral-<task-id>.md`",
    "Compilation or a successful build is not sufficient",
    "Never claim execution continues in the background",
    "sole authority for completion",
  ]) assert.ok(agent.includes(phrase), `missing instruction: ${phrase}`)
})

test("parallel writers require separate verified worktrees and central integration", () => {
  for (const phrase of [
    "one separate Git worktree and branch per writer",
    "Before any child edits",
    "continue the implementation sequentially",
    "Integral reviews each delivery",
  ]) assert.ok(agent.includes(phrase), `missing instruction: ${phrase}`)
  assert.ok(readme.includes("un worktree y una rama propios"))
})

test("project initialization captures branch policy and excludes checkpoints", () => {
  assert.ok(init.includes("never assume the destination branch"))
  assert.ok(init.includes("Add `/.opencode/checkpoints/`"))
})

function git(repo, ...args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" })
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`)
  return result.stdout
}

async function createRepo(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "integral-git-test-"))
  t.after(() => rm(temp, { recursive: true, force: true }))
  const repo = path.join(temp, "repo")
  await mkdir(repo)
  git(repo, "init", "-b", "develop")
  git(repo, "config", "user.name", "Integral Test")
  git(repo, "config", "user.email", "integral-test@example.invalid")
  await writeFile(path.join(repo, "base.txt"), "base\n")
  await writeFile(path.join(repo, "shared.txt"), "common base\n")
  git(repo, "add", "base.txt", "shared.txt")
  git(repo, "commit", "-m", "base")
  return { temp, repo }
}

async function commitFile(repo, name, content, message) {
  const file = path.join(repo, name)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content)
  git(repo, "add", name)
  git(repo, "commit", "-m", message)
}

test("disposable worktrees isolate parallel changes and integrate cleanly", async (t) => {
  const { temp, repo } = await createRepo(t)
  git(repo, "branch", "feature/alpha")
  git(repo, "branch", "feature/beta")
  const alpha = path.join(temp, "alpha")
  const beta = path.join(temp, "beta")
  git(repo, "worktree", "add", alpha, "feature/alpha")
  git(repo, "worktree", "add", beta, "feature/beta")
  t.after(() => {
    spawnSync("git", ["-C", repo, "worktree", "remove", alpha], { stdio: "ignore" })
    spawnSync("git", ["-C", repo, "worktree", "remove", beta], { stdio: "ignore" })
  })

  await commitFile(alpha, "alpha.txt", "alpha\n", "alpha work")
  await commitFile(beta, "beta.txt", "beta\n", "beta work")
  assert.equal(git(repo, "status", "--porcelain"), "")
  git(repo, "merge", "--no-ff", "--no-edit", "feature/alpha")
  git(repo, "merge", "--no-ff", "--no-edit", "feature/beta")
  assert.equal(await readFile(path.join(repo, "alpha.txt"), "utf8"), "alpha\n")
  assert.equal(await readFile(path.join(repo, "beta.txt"), "utf8"), "beta\n")
  assert.equal(git(repo, "status", "--porcelain"), "")
})

test("new feature work integrates while unrelated uncommitted edits survive", async (t) => {
  const { repo } = await createRepo(t)
  git(repo, "switch", "-c", "feature/work")
  await commitFile(repo, "feature.txt", "previous feature\n", "previous feature work")
  git(repo, "switch", "develop")
  git(repo, "merge", "--no-ff", "--no-edit", "feature/work")

  git(repo, "switch", "feature/work")
  await writeFile(path.join(repo, "feature.txt"), "new verified work\n")
  await writeFile(path.join(repo, "user-notes.txt"), "keep this user edit\n")
  git(repo, "add", "feature.txt")
  git(repo, "commit", "-m", "new feature work")
  assert.match(git(repo, "status", "--porcelain"), /user-notes\.txt/)

  git(repo, "switch", "develop")
  git(repo, "merge", "--no-ff", "--no-edit", "feature/work")
  assert.equal(await readFile(path.join(repo, "feature.txt"), "utf8"), "new verified work\n")
  assert.equal(await readFile(path.join(repo, "user-notes.txt"), "utf8"), "keep this user edit\n")
  assert.match(git(repo, "status", "--porcelain"), /user-notes\.txt/)
  assert.equal(git(repo, "branch", "--show-current").trim(), "develop")
})

test("conflicts remain visible with both sides intact", async (t) => {
  const { repo } = await createRepo(t)
  git(repo, "switch", "-c", "feature/conflict")
  await commitFile(repo, "shared.txt", "feature side\n", "feature edit")
  git(repo, "switch", "develop")
  await commitFile(repo, "shared.txt", "develop side\n", "develop edit")

  const merge = spawnSync("git", ["-C", repo, "merge", "--no-ff", "--no-edit", "feature/conflict"], { encoding: "utf8" })
  assert.notEqual(merge.status, 0)
  assert.match(git(repo, "status", "--porcelain"), /UU shared\.txt/)
  const content = await readFile(path.join(repo, "shared.txt"), "utf8")
  assert.ok(content.includes("feature side"))
  assert.ok(content.includes("develop side"))
  assert.equal(git(repo, "branch", "--show-current").trim(), "develop")
})

function runInstaller(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 120_000 })
  assert.equal(result.status, 0, `installer failed:\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}

async function makePackageFixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "integral-package-test-"))
  t.after(() => rm(temp, { recursive: true, force: true }))
  const fixture = path.join(temp, "source")
  await mkdir(fixture)
  for (const item of ["package.json", "README.md", "agents", "bin", "commands", "lib", "plugins"]) {
    await cp(path.join(root, item), path.join(fixture, item), { recursive: true })
  }
  await mkdir(path.join(fixture, "node_modules"))
  try {
    await symlink(path.join(root, "node_modules", "jsonc-parser"), path.join(fixture, "node_modules", "jsonc-parser"), "junction")
  } catch (error) {
    t.skip(`Cannot create isolated package dependency fixture: ${error.message}`)
  }
  return { temp, fixture }
}

test("installer preserves user config, migrates old files, updates atomically, and is repeatable", async (t) => {
  const { temp, fixture } = await makePackageFixture(t)
  const configDir = path.join(temp, "xdg config", "opencode")
  await mkdir(path.join(configDir, "agents"), { recursive: true })
  await mkdir(path.join(configDir, "commands"), { recursive: true })
  await mkdir(path.join(configDir, "plugins"), { recursive: true })
  await symlink(path.join(fixture, "plugins/integral-model-switch"), path.join(configDir, "plugins/integral-model-switch"), "junction")
  await symlink(path.join(fixture, "plugins/integral-sidebar"), path.join(configDir, "plugins/integral-sidebar"), "junction")

  const learn = "# My private memory\n\n- keep unchanged\n"
  await writeFile(path.join(configDir, "LEARN.md"), learn)
  const originalAgent = "# My customized Integral agent\n"
  await writeFile(path.join(configDir, "agents/integral.md"), originalAgent)
  const originalCommand = "# My customized command\n"
  await writeFile(path.join(configDir, "commands/integral-modelos.md"), originalCommand)
  const configText = `{
  "$schema": "https://opencode.ai/config.json",
  // Preserve user settings and comments.
  "model": "provider/model",
  "instructions": ["custom.md"],
  "agents": { "integral": { "description": "user description", "other": true } },
  "plugins": ["other-plugin", "./plugins/integral-model-switch"],
  "experimental": { "customFeature": true }
}
`
  await writeFile(path.join(configDir, "opencode.jsonc"), configText)
  await writeFile(path.join(configDir, "cli.json"), `{
  // Preserve CLI config.
  "theme": { "name": "user-theme" },
  "plugins": ["other-cli-plugin"]
}
`)

  const script = path.join(fixture, "bin/integral.js")
  const first = runInstaller(script, "--config-dir", configDir)
  assert.match(first, /installed and verified/)
  const serverText = await readFile(path.join(configDir, "opencode.jsonc"), "utf8")
  const server = jsoncParser.parse(serverText)
  assert.ok(serverText.includes("// Preserve user settings and comments."))
  assert.equal(server.model, "provider/model")
  assert.deepEqual(server.instructions, ["custom.md", path.join(configDir, "LEARN.md"), ".opencode/LEARN.md"])
  assert.equal(server.agents.integral.description, "user description")
  assert.equal(server.agents.integral.other, true)
  assert.equal(server.agents.integral.mode, "primary")
  assert.equal(server.experimental.customFeature, true)
  assert.equal(server.experimental.todo, true)
  assert.ok(server.plugins.includes(path.join(configDir, "integral/current/plugins/integral-model-switch")))
  const cliText = await readFile(path.join(configDir, "cli.json"), "utf8")
  const cli = jsoncParser.parse(cliText)
  assert.ok(cliText.includes("// Preserve CLI config."))
  assert.equal(cli.theme.name, "user-theme")
  assert.ok(cli.plugins.some((entry) => entry.package === path.join(configDir, "integral/current/plugins/integral-sidebar")))
  assert.equal(cli.plugins[1].options.configDir, configDir)
  assert.equal(await readFile(path.join(configDir, "LEARN.md"), "utf8"), learn)
  assert.notEqual(await readFile(path.join(configDir, "agents/integral.md"), "utf8"), originalAgent)
  assert.notEqual(await readFile(path.join(configDir, "commands/integral-modelos.md"), "utf8"), originalCommand)
  assert.equal(await lstat(path.join(configDir, "agents/integral.md")).then((stat) => stat.isSymbolicLink()), false)

  const backupRoot = path.join(configDir, ".integral-backups")
  const backups = await readdir(backupRoot)
  assert.equal(backups.length, 1)
  const saved = path.join(backupRoot, backups[0], "files")
  assert.equal(await readFile(path.join(saved, "agents/integral.md"), "utf8"), originalAgent)
  assert.equal(await readFile(path.join(saved, "commands/integral-modelos.md"), "utf8"), originalCommand)
  assert.equal(await readlink(path.join(saved, "plugins/integral-model-switch")), path.join(fixture, "plugins/integral-model-switch"))
  assert.equal(await readlink(path.join(saved, "plugins/integral-sidebar")), path.join(fixture, "plugins/integral-sidebar"))
  assert.equal(await readFile(path.join(configDir, "LEARN.md"), "utf8"), learn)

  const current = path.join(configDir, "integral/current")
  const oldRelease = await readlink(current)
  runInstaller(script, "--config-dir", configDir, "--check")
  const configMtime = (await lstat(path.join(configDir, "opencode.jsonc"))).mtimeMs
  assert.match(runInstaller(script, "--config-dir", configDir), /already installed and verified/)
  assert.equal((await lstat(path.join(configDir, "opencode.jsonc"))).mtimeMs, configMtime)

  const packagePath = path.join(fixture, "package.json")
  const manifest = JSON.parse(await readFile(packagePath, "utf8"))
  manifest.version = "1.0.1"
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(path.join(fixture, "agents/integral.md"), `${await readFile(path.join(fixture, "agents/integral.md"), "utf8")}\n<!-- release 1.0.1 -->\n`)
  assert.match(runInstaller(script, "--config-dir", configDir), /1\.0\.1 installed and verified/)
  assert.notEqual(await readlink(current), oldRelease)
  assert.ok(await lstat(path.join(configDir, "integral", oldRelease)))
  assert.ok((await readFile(path.join(configDir, "agents/integral.md"), "utf8")).includes("release 1.0.1"))
  assert.equal(await readFile(path.join(configDir, "LEARN.md"), "utf8"), learn)
  assert.equal(runInstaller(script, "--config-dir", configDir, "--check").includes("package verified"), true)
})

test("dry run and invalid options do not create the target configuration", async (t) => {
  const { temp } = await makePackageFixture(t)
  const target = path.join(temp, "dry-run config")
  const result = runInstaller(path.join(root, "bin/integral.js"), "--config-dir", target, "--dry-run")
  assert.match(result, /No files were changed/)
  await assert.rejects(lstat(target), { code: "ENOENT" })
  const invalid = spawnSync(process.execPath, [path.join(root, "bin/integral.js"), "--unknown"], { encoding: "utf8" })
  assert.notEqual(invalid.status, 0)
  await assert.rejects(lstat(target), { code: "ENOENT" })

  const failedCheck = spawnSync(process.execPath, [
    path.join(root, "bin/integral.js"),
    "--config-dir",
    target,
    "--check",
  ], { encoding: "utf8" })
  assert.equal(failedCheck.status, 1)
})

test("installed agent and plugin registrations are discovered by OpenCode when available", async (t) => {
  const probe = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 10_000 })
  if (probe.error || probe.status !== 0) {
    t.skip("OpenCode CLI is not installed in this test environment.")
    return
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), "integral-opencode-test-"))
  t.after(() => rm(temp, { recursive: true, force: true }))
  const xdg = path.join(temp, "xdg")
  const configDir = path.join(xdg, "opencode")
  runInstaller(path.join(root, "bin/integral.js"), "--config-dir", configDir)

  const env = { ...process.env, XDG_CONFIG_HOME: xdg }
  delete env.OPENCODE_CONFIG_DIR
  const agentList = spawnSync("opencode", ["debug", "agents", "--standalone"], {
    cwd: temp,
    env,
    encoding: "utf8",
    timeout: 120_000,
  })
  assert.equal(agentList.status, 0, agentList.stderr)
  const agents = JSON.parse(agentList.stdout)
  const integral = agents.find((agent) => agent.id === "integral")
  assert.ok(integral, "Integral agent was not discovered")
  assert.ok(integral.system.includes("Completion-driven workflow"))

  const plugins = spawnSync("opencode", ["plugin", "list", "--standalone"], {
    cwd: temp,
    env,
    encoding: "utf8",
    timeout: 120_000,
  })
  assert.equal(plugins.status, 0, plugins.stderr)
  assert.ok(plugins.stdout.includes(path.join(configDir, "integral/current/plugins/integral-sidebar")))
})
