---
description: Inicializa instrucciones del proyecto como /init y prepara las funciones de Integral
agent: integral
subagent: false
---

Prepara el proyecto activo para que pueda desarrollarse con Integral. Esta primera sección reproduce el flujo guiado de `/init` de OpenCode; las secciones siguientes completan su preparación con Git, planificación y funciones de Integral. No generes código de aplicación ni instales dependencias.

## 0. Proyecto vacío

Inspecciona primero la raíz activa. Si no hay código, documentación del proyecto, especificaciones, planificación ni instrucciones sustantivas que permitan identificar su propósito, todavía no inicialices archivos ni Git: pregunta con la interfaz nativa si el usuario quiere inicializar el proyecto y espera su respuesta.

- Si responde que no, termina sin cambios.
- Si responde que sí pero no ha indicado el objetivo del proyecto, pregunta en un único lote breve por propósito, resultado esperado, restricciones y cualquier tecnología que ya haya elegido. Espera antes de crear archivos; no deduzcas stack ni requisitos.
- Tras la confirmación y con contexto suficiente, ejecuta los pasos de preparación de abajo.

Si ya hay código o documentos sustantivos, procede a completar la preparación de lo que falte. Si el objetivo o una decisión necesaria no puede obtenerse de los archivos, pregunta antes de inventarla.

## 1. Git local

Determina si el proyecto activo ya pertenece a un repositorio Git. Ejecuta comandos de shell siempre explícitamente con Bash. Si no pertenece a uno, inicializa un repositorio local en la raíz activa con `bash -c 'git init'`. No crees un repositorio anidado si el directorio ya está dentro de otro repositorio. No configures remotos, no hagas commits ni push. No inicialices Git en un directorio padre, el home o el repositorio Integral.

## 2. `.gitignore` básico

Comprueba si existe `.gitignore`. Si falta, crea uno breve con exclusiones genéricas seguras (`.env`, `.env.*` excepto `.env.example`, `.DS_Store` y `Thumbs.db`) y añade `.opencode/LEARN.md` para que la memoria local no se publique accidentalmente. Si ya existe, consérvalo y añade solo las entradas que falten, sin reemplazar reglas del proyecto. Añade exclusiones específicas de dependencias o artefactos únicamente cuando el stack esté comprobado.

## 3. Instrucciones del proyecto (flujo de `/init`)

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

## 4. Planificación mínima

Comprueba si ya existe planificación útil (por ejemplo `PLAN.md`, roadmap, issues o especificación). Si existe, consérvala y úsala. Si no existe, crea `PLAN.md` en la raíz con el objetivo y alcance confirmado, estado actual, fases de trabajo pendientes y decisiones o preguntas abiertas. Basa el contenido en el proyecto y en las respuestas del usuario; no inventes backlog, stack, requisitos o fechas. Si no hay trabajo pendiente identificable, indícalo en vez de fabricar tareas.

## 5. LEARN de Integral

Ejecuta el inicializador con Bash: `bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-learn-init.py"'`. Comprueba su salida y resume las rutas creadas, existentes o con errores. Si falla, no afirmes éxito ni crees las memorias a mano. Respeta cualquier archivo existente; no copies preferencias entre memorias ni agregues preferencias por el usuario durante una inicialización.

## 6. Modelos por tarea de Integral

Con `AGENTS.md`, planificación mínima y LEARN preparados, lee `commands/integral-modelos.md` instalado y sigue su procedimiento completo. Analiza la carga pendiente por fase, pregunta al usuario qué proveedor usar, evalúa todos los modelos disponibles de ese proveedor, contrasta el catálogo con Artificial Analysis y genera o actualiza `MODELS-PROJECT`. Conserva íntegro el contenido fuera de esa sección. Si no hay evidencia suficiente, documenta el bloqueo; no inventes asignaciones ni elijas otro proveedor. No delegues a subagentes.

## 7. Cierre

Comprueba Git, `.gitignore`, `AGENTS.md`, la planificación, el resultado de LEARN y la sección de modelos —o el bloqueo documentado—. Resume qué se creó o conservó y cualquier limitación. No cambies el código de la aplicación ni instales dependencias.
