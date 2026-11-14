---
description: Evaluate models from a selected provider and update task assignments
agent: integral
subagent: false
---

Evaluate models for this project and save the result in its `AGENTS.md`. This is the `/integral-modelos` command. Do not modify application code as part of the current task.

First check whether the project has enough context to assess pending work: code, specifications, substantive documentation, a minimal plan, or other relevant artifacts. An automatically generated `AGENTS.md`, LEARN, `.git`, or OpenCode configuration alone is not sufficient.

If the directory is empty or lacks substantive context, use OpenCode's native question interface to ask whether the user wants to initialize it before evaluating models. Wait for the answer:
- If the user declines, finish without changes or evaluation.
- If the user agrees, that satisfies the confirmation required by `/integral-init`; do not repeat the question. Perform the minimum setup through its LEARN step (confirmed goal, local Git if missing, `.gitignore`, `AGENTS.md`, plan, and LEARN). Skip its model-assignment step because this command will perform that evaluation. Do not generate application code or install dependencies. If the goal is missing, ask and wait. Continue only after sufficient project context exists.

Once the project is ready, analyze pending work and tasks remaining in each phase. Only then ask which OpenCode-configured provider the user wants evaluated. Use OpenCode's native question interface and offer only providers listed below. Do not evaluate models or write `AGENTS.md` before receiving the answer. Do not infer the choice from the session model, favorites, list order, or other preferences. If no providers are configured or the chosen provider has no available models, explain this and ask the user to configure or select a provider; do not switch providers on your own.

## OpenCode data

Configured providers. The output is limited to IDs and names to avoid exposing settings or credentials:
!`bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-modelos-data.py" providers'`

## Evaluation

1. After the provider is selected, run through Bash: `bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-modelos-data.py" models "$1"' bash 'PROVIDER_ID'`, replacing `PROVIDER_ID` with the exact ID selected by the user. This helper queries the full catalog and returns only non-sensitive metadata. Evaluate **all** available chat models from that provider, not just favorites. Do not switch or assume a provider. For each relevant model and variant, examine its name, capabilities, modalities, context, catalog cost, and other technical evidence. Exclude unavailable models and do not infer unsupported capabilities.
2. Continue external research on Artificial Analysis: open `https://artificialanalysis.ai/models` and follow the pages for all relevant models and variants from the chosen provider. Do not replace this source or start with a generic web search elsewhere.
   - Collect only published metrics: relevant indexes and benchmarks (e.g. coding/agentic), cost, time per task/latency, context window, and modalities. Record the variant, access date, and specific links.
   - Compare tasks using evidence relevant to the project's work; do not treat an aggregate index as a guarantee of performance in this repository. Do not extrapolate metrics across variants.
   - Compare published data with the OpenCode catalog. Note discrepancies in context, modalities, price, availability, or variant identity. Artificial Analysis reflects its own tests and reference pricing, which may differ from the provider or execution route configured in OpenCode.
   - If a page or metric is unavailable, report it as unavailable; do not fill gaps by inference. If web access is unavailable, continue only if remaining evidence is sufficient and explicitly note the limitation.
3. Use the initial pending-work analysis to determine which phases/tasks need assignments. Consider at least analysis, planning/architecture, development, design/UI review, writing/running tests, debugging, and final review; explain if any do not apply. Preserve explicit user decisions.
4. Recommend a model **and variant/level** for each task based on combined evidence and that phase's workload. One selection may cover multiple tasks. Distinguish reasoning effort from model capabilities and explain uncertainty when evidence does not support a reliable comparison.
5. Optimize the intelligence/cost/time relationship, always prioritizing cost savings over speed:
   - First determine the minimum capability level supported by sufficient evidence to complete each task reliably. Do not choose a cheaper option if evidence suggests it falls below the required level.
   - Among options that meet that level, prioritize the lowest cost per task. Use time only as a secondary tiebreaker between similarly priced options or when delay would materially affect the work.
   - Consider per-task cost and time published by Artificial Analysis, as well as relevant indexes and benchmarks. If per-task cost is unavailable for a variant, do not infer it or extrapolate it: use documented prices only as a clearly labeled approximation, or mark the cost comparison unavailable.
   - Do not sacrifice critical capability for a marginal speed gain. Explain the capability/cost/time tradeoff and confidence for each assignment.
6. **After the provider is selected**, update the root `AGENTS.md` on every run: replace only the content of the single section delimited exactly by `<!-- MODELS-PROJECT:START -->` and `<!-- MODELS-PROJECT:END -->`, even if assignments remain unchanged. Refresh at least the date, chosen provider, and consulted evidence. Do not replace or reorder the rest of the file. If `AGENTS.md` does not exist, create it with this section.
7. Include in that section the date, chosen provider, pending workload by phase, evaluated models/variants, sources with links and access dates, evidence discrepancies/limitations, a task → `provider/model#variant` → brief rationale table, and a confidence indicator for each assignment. Explain how cost was prioritized over time. State that Integral should use this table and not reevaluate models for every task. If there are no models or insufficient evidence, still update the section with the blocker and missing information; do not invent assignments or retain an old table as if it had been validated in this run.
8. Summarize the detected workload, chosen provider, assigned models, evidence used, remaining uncertainties, and the exact path to the updated `AGENTS.md`. Follow Integral's selective delegation policy for independent research or verification; do not delegate the user choice, final recommendations, or `AGENTS.md` integration.

Optional arguments: $ARGUMENTS
