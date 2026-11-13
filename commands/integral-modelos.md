---
description: Evalúa los modelos de un proveedor elegido y actualiza las asignaciones por tarea
agent: integral
subagent: false
---

Realiza una evaluación de modelos para este proyecto y guarda el resultado en su `AGENTS.md`. Este es el comando `/integral-modelos`. No hagas cambios de código de la tarea en curso.

Primero inspecciona si el proyecto tiene contexto suficiente para evaluar la carga pendiente: código, especificaciones, documentación sustantiva, una planificación mínima u otros artefactos pertinentes. `AGENTS.md` generado automáticamente, LEARN, `.git` o la configuración de OpenCode por sí solos no bastan.

Si el directorio está vacío o carece de contexto sustantivo, pregunta con la interfaz nativa si el usuario quiere inicializarlo antes de evaluar modelos. Espera la respuesta:
- Si responde que no, termina sin cambios ni evaluación.
- Si responde que sí, esa respuesta satisface la confirmación requerida por `/integral-init`: no repitas la misma pregunta. Prepara el mínimo necesario siguiendo sus pasos de preparación hasta LEARN (objetivo confirmado, Git local si falta, `.gitignore`, `AGENTS.md`, planificación y LEARN); no ejecutes su sección de modelos, porque esta invocación continuará con esa evaluación. No generes código ni instales dependencias. Si falta el objetivo, pregúntalo y espera. Continúa la evaluación solo después de que exista contexto suficiente.

Cuando el proyecto esté listo, analiza la carga pendiente y las tareas que faltan por fase. Solo después pregunta al usuario qué proveedor configurado en OpenCode quiere evaluar. Usa la pregunta nativa de OpenCode y ofrece únicamente los proveedores enumerados abajo. No evalúes modelos ni escribas `AGENTS.md` antes de recibir respuesta. No deduzcas la elección a partir del modelo de sesión, favoritos, orden de la lista u otras preferencias. Si no hay proveedores configurados o el proveedor elegido no tiene modelos disponibles, explícalo y solicita configurar/seleccionar un proveedor; no continúes con otro por cuenta propia.

## Datos de OpenCode

Proveedores configurados. La salida está limitada a identificadores y nombres para no incluir ajustes ni credenciales:
!`bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-modelos-data.py" providers'`

## Evaluación

1. Después de la elección, ejecuta con Bash `bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-modelos-data.py" models "$1"' bash 'PROVIDER_ID'`, sustituyendo `PROVIDER_ID` por el identificador exacto elegido por el usuario. Este ayudante consulta el catálogo completo y devuelve solo metadatos no sensibles. Evalúa **todos** los modelos chat disponibles de ese proveedor, no solo favoritos. No cambies ni asumas proveedor. Para cada modelo y variante pertinente, examina nombre, capacidades, modalidades, contexto, coste del catálogo y cualquier otra evidencia técnica. Descarta modelos no disponibles y no deduzcas capacidades que no estén respaldadas por datos o documentación.
2. La búsqueda externa se sigue haciendo en Artificial Analysis: abre `https://artificialanalysis.ai/models` y desde allí sigue las fichas de todos los modelos y variantes pertinentes del proveedor elegido. No sustituyas esta fuente ni empieces por una búsqueda genérica fuera de ese sitio.
   - Recoge solo métricas efectivamente publicadas: índices y benchmarks relevantes (p. ej., coding/agentic), coste, tiempo por tarea/latencia, ventana de contexto y modalidades. Anota variante, fecha de consulta y enlaces concretos.
   - Compara tareas con evidencia pertinente al trabajo del proyecto; no conviertas un índice agregado en garantía de rendimiento en este repositorio. No extrapoles métricas de una variante a otra.
   - Contrasta lo publicado con el catálogo de OpenCode. Señala discrepancias de contexto, modalidades, precio, disponibilidad o identificación de variante. Artificial Analysis describe sus propias pruebas y precios de referencia, que pueden no coincidir con el proveedor/ruta de ejecución configurados en OpenCode.
   - Si la página o una métrica no está accesible, indícalo como dato no disponible; no completes huecos por inferencia. Si no puedes consultar la web, continúa solo si la evidencia restante basta y deja constancia explícita de esa limitación.
3. Usa el análisis inicial de la carga pendiente para determinar qué fases/tareas necesitan asignación. Considera al menos análisis, planificación/arquitectura, desarrollo, diseño/revisión UI/UX, escritura/ejecución de pruebas, depuración y revisión final; explica si alguna no aplica al proyecto. Conserva cualquier decisión explícita del usuario.
4. Recomienda modelo **y variante/nivel** por tarea según la evidencia combinada y la carga de trabajo de esa fase. Una misma selección puede cubrir varias tareas. Distingue razonamiento de capacidades del modelo y explica incertidumbre cuando la evidencia no permita una comparación fiable.
5. Optimiza la relación inteligencia/coste/tiempo priorizando siempre el ahorro de costes por encima de la velocidad:
   - Primero determina el nivel mínimo de capacidad respaldado por evidencia suficiente para completar cada tarea con fiabilidad. No elijas una opción barata si la evidencia sugiere que no llega al nivel requerido.
   - Entre las opciones que sí alcancen ese nivel, prioriza la de menor coste por tarea; solo usa el tiempo como criterio secundario para desempatar opciones de coste comparable o cuando una demora afecte materialmente el trabajo.
   - Considera coste y tiempo por tarea publicados en Artificial Analysis, además de índices y benchmarks pertinentes. Si no hay coste por tarea para una variante, no lo infieras ni lo extrapoles: usa precios documentados solo como aproximación claramente etiquetada o deja la comparación de coste como no disponible.
   - No sacrifiques capacidad crítica por una mejora marginal de tiempo. Explica la relación capacidad-coste-tiempo y la confianza en cada asignación.
6. En **cada ejecución**, una vez elegido el proveedor, actualiza obligatoriamente el `AGENTS.md` raíz: reemplaza el contenido de la única sección delimitada exactamente por `<!-- MODELS-PROJECT:START -->` y `<!-- MODELS-PROJECT:END -->`, aunque las asignaciones resulten iguales. Refresca al menos fecha, proveedor elegido y evidencia consultada. No sustituyas ni reordenes el resto del archivo. Si no existe `AGENTS.md`, créalo con la sección.
7. Incluye dentro de la sección fecha, proveedor elegido, carga de trabajo pendiente por fase, modelos/variantes evaluados, fuentes con enlaces y fecha de consulta, discrepancias/limitaciones de la evidencia, una tabla de tarea → `provider/model#variant` → justificación breve y un indicador de confianza por asignación. Explica cómo se priorizó coste frente a tiempo. Indica que Integral debe usar esta tabla y no reevaluarla en cada tarea. Si no hay modelos o evidencia suficiente, actualiza igualmente la sección indicando el bloqueo y qué información falta; no inventes asignaciones ni conserves una tabla antigua como si se hubiera validado en esta ejecución.
8. Resume la carga de trabajo detectada, el proveedor elegido, los modelos asignados, la evidencia usada, qué quedó incierto y la ruta exacta del `AGENTS.md` actualizado. No delegues a subagentes.

Argumentos opcionales: $ARGUMENTS
