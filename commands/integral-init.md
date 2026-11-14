---
description: Initialize project instructions like /init and set up Integral features
agent: integral
subagent: false
---

Prepare the active project for development with Integral. The first section reproduces OpenCode's guided `/init` workflow; the following sections complete project setup with Git, planning, and Integral features. Do not generate application code or install dependencies.

## 0. Empty project

First inspect the active project root. If there is no code, project documentation, specification, plan, or substantive instructions that identify its purpose, do not create files or initialize Git yet. Use OpenCode's native question interface to ask whether the user wants to initialize the project, then wait for the answer.

- If the user declines, finish without making changes.
- If the user agrees but has not stated the project's goal, ask in one concise batch about its purpose, expected outcome, constraints, and any technology already chosen. Wait before creating files; do not infer a stack or requirements.
- After confirmation and once sufficient context is available, perform the setup steps below.

If code or substantive documents already exist, complete any missing setup. If the goal or a necessary decision cannot be determined from the files, ask rather than inventing it.

## 1. Local Git repository

Determine whether the active project already belongs to a Git repository. Always run shell commands explicitly through Bash. If it does not, initialize a local repository at the active root with `bash -c 'git init'`. Do not create a nested repository if the directory is already inside another repository. Do not configure remotes, commit, or push. Never initialize Git in a parent directory, the home directory, or the Integral repository.

## 2. Basic `.gitignore`

Check whether `.gitignore` exists. If it is missing, create a brief file with safe generic exclusions (`.env`, `.env.*` except `.env.example`, `.DS_Store`, and `Thumbs.db`) and add `.opencode/LEARN.md` so local memory is not accidentally published. If it already exists, preserve it and add only missing entries without replacing project rules. Add stack-specific dependency or artifact exclusions only when the stack is verified.

## 3. Project instructions (`/init` workflow)

Create or update `AGENTS.md` for this repository.

The goal is a compact instruction file that helps future OpenCode sessions avoid mistakes and ramp up quickly. Every line should answer: "Would an agent likely miss this without help?" If not, leave it out.

User-provided focus or constraints (honor these):
$ARGUMENTS

### How to investigate

Read the highest-value sources first:
- `README*`, root manifests, workspace config, lockfiles
- build, test, lint, formatter, typecheck, and codegen config
- CI workflows and pre-commit / task runner config
- existing instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`)
- repo-local OpenCode config such as `opencode.json`

If architecture is still unclear after reading config and docs, inspect a small number of representative code files to find the real entrypoints, package boundaries, and execution flow. Prefer reading the files that explain how the system is wired together over random leaf files.

Prefer executable sources of truth over prose. If docs conflict with config or scripts, trust the executable source and only keep what you can verify.

### What to extract

Look for the highest-signal facts for an agent working in this repo:
- exact developer commands, especially non-obvious ones
- how to run a single test, a single package, or a focused verification step
- required command order when it matters, such as `lint -> typecheck -> test`
- monorepo or multi-package boundaries, ownership of major directories, and the real app/library entrypoints
- framework or toolchain quirks: generated code, migrations, codegen, build artifacts, special env loading, dev servers, infra deploy flow
- testing quirks: fixtures, integration test prerequisites, snapshot workflows, required services, flaky or expensive suites
- important constraints from existing instruction files worth preserving
- the project's actual branch, merge/pull-request, commit, and push expectations; never assume the destination branch
- acceptance criteria and the existing progress/checkpoint conventions, if any

Good `AGENTS.md` content is usually hard-earned context that took reading multiple files to infer.

### Questions

Only ask the user questions if the repo cannot answer something important. Use the native question interface for one short batch at most.

Good questions:
- undocumented team conventions
- branch / PR / release expectations
- missing setup or test prerequisites that are known but not written down

Do not ask about anything the repo already makes clear.

### Writing rules

Include only high-signal, repo-specific guidance such as:
- exact commands and shortcuts the agent would otherwise guess wrong
- architecture notes that are not obvious from filenames
- conventions that differ from language or framework defaults
- setup requirements, environment quirks, and operational gotchas
- references to existing instruction sources that matter

Exclude:
- generic software advice
- long tutorials or exhaustive file trees
- obvious language conventions
- speculative claims or anything you could not verify
- content better stored in another file referenced via `opencode.json` `instructions`

When in doubt, omit. Prefer short sections and bullets. If the repo is simple, keep the file simple; if large, summarize only structural facts that change how an agent should work.

If `AGENTS.md` already exists, improve it in place rather than rewriting blindly. Preserve verified useful guidance and user-authored constraints, remove only fluff or stale claims, and reconcile it with the current codebase. Keep any content outside a section you update.

## 4. Minimal project plan

Check whether useful planning already exists (for example, `PLAN.md`, a roadmap, issues, or a specification). Preserve and use it if present. Otherwise, create a root-level `PLAN.md` with the confirmed goal and scope, current status, pending work by phase, and open decisions or questions. Base it on the project and the user's answers; do not invent a backlog, stack, requirements, or dates. If no pending work can be identified, say so instead of fabricating tasks.

## 4a. Continuity and Git workflow

Record verified, high-signal project-specific completion criteria and Git expectations in `AGENTS.md`: how to identify the agreed destination branch, whether commits, integration, and push are expected, and any required checks. If the repository does not establish a material convention, ask the user once using the native question interface; do not assume `develop`, create a remote, or publish during initialization.

Integral keeps task checklists and temporary recovery checkpoints in `.opencode/checkpoints/`, separate from `LEARN.md` and long-lived project plans. Add `/.opencode/checkpoints/` to the project's `.gitignore` without replacing existing rules, unless the user explicitly wants checkpoints versioned. Checkpoints must contain no secrets or personal data. They do not replace task commits or project documentation.

For parallel implementation, Integral may delegate only independent, bounded work. Each writer must have its own verified Git worktree and branch, explicit file ownership and acceptance criteria. If its session cannot be verified in the assigned worktree before editing, continue serially. Integral reviews, verifies, and centrally integrates all delivered work; worktrees do not isolate shared services such as databases or ports.

## 5. Integral LEARN memories

Run the initializer through Bash: `bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-learn-init.py"'`. Check its output and summarize paths created, already present, or reporting errors. If it fails, do not claim success or create the memories manually. Preserve all existing files; do not copy preferences between memories or add user preferences during initialization.

## 6. Integral model assignments

Once `AGENTS.md`, the minimum plan, and LEARN are ready, read the installed `commands/integral-modelos.md` and follow its full procedure. Analyze pending work by phase, ask the user which provider to use, evaluate all available models from that provider, compare the catalog with Artificial Analysis, and create or update `MODELS-PROJECT`. Preserve all content outside that section. If evidence is insufficient, document the blocker; do not invent assignments or choose another provider.

## 7. Completion

Verify Git, `.gitignore`, `AGENTS.md`, the plan, the LEARN result, and the model section—or its documented blocker. Summarize what was created or preserved and any limitations. Do not change application code or install dependencies.
