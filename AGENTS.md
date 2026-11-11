# Global Model Routing

OpenCode loads a dynamic model router from `~/.config/opencode/plugins/model-router.js`.
The router queries the models available to the OpenAI provider on every startup. Do not
hardcode a model list or assume that a model is available if it is not present in the
dynamic catalog injected into the system context.

## Selection Policy

- Use the lowest reasoning variant that can complete the task reliably.
- Prefer low or minimal reasoning for exploration, extraction, small edits, and simple searches.
- Prefer medium reasoning for normal implementation, debugging, and coordinated code changes.
- Prefer high reasoning for planning, architecture, reviews, migrations, security, and difficult debugging.
- Use xhigh or max only when the task genuinely needs deep analysis and the selected model supports it.
- Prefer lower-cost models when capability and tool support are sufficient.
- Treat fast variants as a latency optimization, not as an automatic quality improvement.
- Never invent model IDs or variants.

## Manual Model Selection

If the user selected a model manually and it differs from the global model, OpenCode must
show a comparison before using tools. Explain the cost, speed, reasoning, and capability
trade-offs of both models, mark the router's choice with `(Recomendado)`, and wait for the
user to choose `recomendado` or `seleccionado`.

Do not read, edit, execute commands, or call other tools while that decision is pending.
The user's choice applies to the current task and its continuation. Use `!new-task` when
the user wants to start a different task in the same session and clear that choice.

## Checklist visible en el sidebar

- En cada sesión de agente, al comenzar a atender el prompt del usuario, crea o reemplaza con `todowrite` una lista breve de pasos para ese prompt y actualízala conforme avances. Esto aplica por separado a agentes nativos (incluidos `plan` y `build`) y personalizados.
- No reutilices tareas de otros prompts ni de sesiones/agentes; marca `completed` solo cuando termines el paso. El sidebar muestra listas independientes por sesión y tacha únicamente las registradas como `completed`.
- Si la petición no requiere pasos, registra un solo paso para responderla. Si todavía no has creado la lista, no afirmes que el sidebar ya refleja el trabajo.

<!-- MODELS-PROJECT:START -->
## Modelos por tarea

**Fecha de evaluación:** 2026-11-11
**Favoritos evaluados:** `openai/gpt-6-astra` y `openai/gpt-6-luna`; ambos disponibles con variantes `low`, `medium`, `high`, `xhigh` y `max`.

**Evidencia y límites:** Catálogo OpenCode (`/api/model`, consultado en esta ejecución) indica herramientas, texto/imagen/PDF, salida de texto y contexto de 400.000 tokens para ambos; no ofrece coste. Artificial Analysis, leaderboard y fichas de [Astra medium](https://artificialanalysis.ai/models/gpt-6-astra-medium), [Astra high](https://artificialanalysis.ai/models/gpt-6-astra-high), [Luna medium](https://artificialanalysis.ai/models/gpt-6-luna-medium) y [Luna high](https://artificialanalysis.ai/models/gpt-6-luna-high), consultados el 2026-11-11, informan: índice Intelligence 52 y 55 para Astra medium/high, frente a 18 y 21 para Luna medium/high; coste estimado por tarea del índice $2.73/$3.24 frente a $0.04/$0.07; duración 7.0/9.7 frente a 3.4/5.7 min. Es un índice agregado v5.0.1 (incluye conocimiento, código, ciencia y trabajo general), no una prueba directa de este repositorio ni desglose suficiente por tipo de tarea. Sus precios corresponden a su estimación de API y no necesariamente a la ruta/cuenta OpenCode. Hay discrepancia en contexto (1M en AA frente a 400k en OpenCode) y entrada (AA indica texto/imagen; OpenCode texto/imagen/PDF): para operar, prevalece el catálogo OpenCode. No se infieren prestaciones particulares por lenguaje ni se interpreta el orden de favoritos como preferencia.

**Integral debe usar esta tabla y no reevaluar modelos en cada tarea.** Actualizarla al volver a ejecutar `/integral-modelos`.

| Tarea | Asignación | Justificación | Confianza |
|---|---|---|---|
| Análisis | `openai/gpt-6-astra#high` | Mayor índice agregado entre variantes candidatas revisadas para razonamiento complejo; alto coste de benchmark. | Media |
| Planificación y arquitectura | `openai/gpt-6-astra#medium` | Índice 52, menor tiempo/coste que Astra high entre variantes Astra revisadas. | Media |
| Desarrollo | `openai/gpt-6-luna#medium` | Alternativa económica y rápida para trabajo habitual; verificar resultados en el repo. | Baja |
| Diseño y revisión UI/UX | `openai/gpt-6-astra#medium` | Mayor índice agregado y entrada de imagen confirmada en AA; no hay benchmark UI específico consultado. | Baja |
| Escritura y ejecución de pruebas | `openai/gpt-6-luna#medium` | Menor coste/tiempo en benchmark agregado; evidencia específica de pruebas no consultada. | Baja |
| Depuración | `openai/gpt-6-astra#medium` | Índice agregado superior; no hay comparación de debugging específica, usar Luna si prima coste. | Baja |
| Revisión final | `openai/gpt-6-astra#high` | Índice agregado más alto de las variantes candidatas consultadas para revisión rigurosa. | Media |

La confianza es media o baja porque los datos comparan variantes mediante pruebas agregadas y no miden directamente las tareas de este proyecto; coste/latencia favorecen a Luna, mientras que el índice agregado favorece a Astra.
<!-- MODELS-PROJECT:END -->
