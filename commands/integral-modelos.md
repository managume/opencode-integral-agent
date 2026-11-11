---
description: Evalúa tus modelos favoritos y actualiza las asignaciones por tarea en AGENTS.md
agent: integral
subagent: false
---

Realiza una evaluación de modelos para este proyecto y guarda el resultado en su `AGENTS.md`. Este es el comando `/integral-modelos`. No hagas cambios de código de la tarea en curso.

## Datos de OpenCode

Favoritos configurados por el usuario:
!`python3 -c 'import json,os; p=os.path.join(os.environ.get("XDG_STATE_HOME",os.path.expanduser("~/.local/state")),"opencode/model.json"); d=json.load(open(p)); print(json.dumps(d.get("favorite",[]),ensure_ascii=False,indent=2))'`

Modelos y variantes disponibles en esta ubicación:
!`opencode api get /api/model`

## Evaluación

1. Usa exclusivamente los modelos marcados como favoritos que estén disponibles en el catálogo proporcionado. Para cada uno, examina nombre, proveedor, capacidades y modalidades, ventana de contexto, variantes, coste si consta y otra evidencia técnica disponible. No deduzcas benchmarks o capacidades que no estén respaldados por los datos o documentación consultada.
2. Consulta Artificial Analysis como fuente externa complementaria para cada favorito y las variantes candidatas:
   - Abre `https://artificialanalysis.ai/models` y sigue desde allí a las fichas de modelo/variante enlazadas; usa también el leaderboard o evaluaciones pertinentes si ayudan a comparar.
   - Recoge solo métricas efectivamente publicadas: índices y benchmarks relevantes (p. ej., coding/agentic), coste, tiempo por tarea/latencia, ventana de contexto y modalidades. Anota variante, fecha de consulta y enlaces concretos.
   - Compara tareas con evidencia pertinente al trabajo del proyecto; no conviertas un índice agregado en garantía de rendimiento en este repositorio. No extrapoles métricas de una variante a otra.
   - Contrasta lo publicado con el catálogo de OpenCode. Señala discrepancias de contexto, modalidades, precio, disponibilidad o identificación de variante. Artificial Analysis describe sus propias pruebas y precios de referencia, que pueden no coincidir con el proveedor/ruta de ejecución configurados en OpenCode.
   - Si la página o una métrica no está accesible, indícalo como dato no disponible; no completes huecos por inferencia. Si no puedes consultar la web, continúa solo si la evidencia restante basta y deja constancia explícita de esa limitación.
3. Inspecciona el proyecto y sus instrucciones actuales para identificar stack, tipo de producto, lenguajes, pruebas, necesidades de razonamiento, diseño UI/UX y restricciones. Conserva cualquier decisión explícita del usuario; no interpretes el orden de favoritos como preferencia de uso ni como ranking de capacidad.
4. Recomienda modelo **y variante/nivel** por tarea según la evidencia combinada y las necesidades del proyecto. Considera al menos: análisis, planificación/arquitectura, desarrollo, diseño/revisión UI/UX, escritura/ejecución de pruebas, depuración y revisión final. Una misma selección puede cubrir varias tareas. Distingue razonamiento de capacidades del modelo y explica incertidumbre cuando la evidencia no permita una comparación fiable.
5. En **cada ejecución**, actualiza obligatoriamente el `AGENTS.md` raíz: reemplaza el contenido de la única sección delimitada exactamente por `<!-- MODELS-PROJECT:START -->` y `<!-- MODELS-PROJECT:END -->`, aunque las asignaciones resulten iguales. Refresca al menos la fecha y la evidencia consultada. No sustituyas ni reordenes el resto del archivo. Si no existe `AGENTS.md`, créalo con la sección.
6. Incluye dentro de la sección fecha, favoritos evaluados, fuentes con enlaces y fecha de consulta, discrepancias/limitaciones de la evidencia, una tabla de tarea → `provider/model#variant` → justificación breve y un indicador de confianza por asignación. Indica que Integral debe usar esta tabla y no reevaluarla en cada tarea. Si no hay favoritos o evidencia suficiente, actualiza igualmente la sección indicando el bloqueo y qué información falta; no inventes asignaciones ni conserves una tabla antigua como si se hubiera validado en esta ejecución.
7. Resume qué asignaste, qué evidencia usaste, qué quedó incierto y la ruta exacta del `AGENTS.md` actualizado. No delegues a subagentes.

Argumentos opcionales: $ARGUMENTS
