---
description: Inicializa instrucciones del proyecto como /init y prepara las funciones de Integral
agent: integral
subagent: false
---

Inicializa el proyecto activo. Esta primera sección reproduce el flujo guiado de `/init` de OpenCode; las secciones siguientes añaden la inicialización de Integral. Completa todos los pasos en esta ejecución; no te limites a explicar qué habría que hacer.

## 1. Instrucciones del proyecto (flujo de `/init`)

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

## 2. LEARN de Integral

Inicializa la memoria global y la del proyecto con el mecanismo idempotente de `/integral-learn`. El comando ejecutó antes de esta solicitud el inicializador y reportó:

!`bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-learn-init.py"'`

Toma esa salida como evidencia del resultado: no vuelvas a ejecutar ni afirmes éxito si reportó errores. Respeta cualquier archivo existente; no copies preferencias entre memorias ni agregues preferencias por el usuario durante una inicialización.

## 3. Modelos por tarea de Integral

Lee el archivo instalado `commands/integral-modelos.md` y sigue su procedimiento completo para evaluar favoritos disponibles, contrastar catálogo OpenCode con Artificial Analysis, indicar fuentes/fecha/límites y generar o actualizar la sección `MODELS-PROJECT` de `AGENTS.md` en la raíz. La tabla es opcional para el uso del agente, pero este comando la genera como parte de la inicialización. Conserva todo el contenido fuera de esa sección. Si faltan favoritos o evidencia, documenta el bloqueo según ese comando; no inventes asignaciones. No delegues a subagentes.

## 4. Cierre

Comprueba que `AGENTS.md` contiene las instrucciones técnicas pertinentes y la sección de modelos —o el bloqueo documentado—, y que las memorias reportadas no se sobrescribieron. Resume los archivos creados/actualizados, qué se inicializó y cualquier limitación. No cambies el código de la aplicación del usuario como parte de esta inicialización.
