# Integral para OpenCode

Integral es un paquete para habilitar un agente de OpenCode, memorias de colaboración, asignaciones de modelos por proyecto y un addon para la TUI. Este repositorio distribuye **el mecanismo**, no los datos personales de una instancia. No contiene una memoria LEARN personal, configuraciones globales de referencia ni tablas de modelos generadas.

## Dominios de funcionalidad

### Agente Integral

`agents/integral.md` define el flujo de colaboración del agente. Integral trabaja con criterios de aceptación y checklist, verifica bloques pequeños y continúa con el siguiente pendiente en el turno disponible. Solo cierra al completar el alcance o alcanzar un bloqueo/límite real; no afirma ejecución en segundo plano. Los checkpoints temporales se guardan en `.opencode/checkpoints/` del proyecto y se contrastan con el estado real al reanudar. Si el proyecto no tiene tabla de modelos o una fase no está asignada, Integral conserva el modelo seleccionado y continúa sin exigir una evaluación. `/integral-modelos` crea o actualiza la sección delimitada en `AGENTS.md` del proyecto activo según el proveedor que elija el usuario. El plugin `plugins/integral-model-switch/` aplica las asignaciones definidas cuando existen.

Integral puede delegar trabajo independiente cuando el ahorro esperado compense la coordinación. Cada escritor paralelo necesita un worktree y una rama propios, verificados antes de editar. Si no es posible garantizar y comprobar el directorio de la sesión hija, el trabajo se hace en serie. Los worktrees no aíslan servicios externos. Integral conserva la revisión, las pruebas del conjunto y la integración central; sigue la rama de destino documentada por cada proyecto, preserva cambios previos y confirma rama y árbol al finalizar.

`/integral-init` prepara el proyecto para desarrollarlo con Integral: si está vacío, primero pide confirmación y el objetivo; después inicializa Git local y `.gitignore` si faltan, crea o actualiza `AGENTS.md`, prepara una planificación mínima, inicializa LEARN y asigna modelos. No crea código de aplicación, instala dependencias, configura remotos ni publica commits.

### Memorias LEARN

`/integral-learn` inicializa con esqueletos limpios la memoria global y la memoria opcional del proyecto, solo si faltan. Nunca sobrescribe archivos existentes.

- Global: `${XDG_CONFIG_HOME:-$HOME/.config}/opencode/LEARN.md`.
- Proyecto: `<raíz-del-proyecto>/.opencode/LEARN.md`.

Cada memoria la genera el comando en el destino del usuario; este repositorio no contiene preferencias personales. La memoria global recoge criterios generales y la local, criterios propios del proyecto. Si discrepan, prevalece la del proyecto.

### Sidebar de Integral

`plugins/integral-sidebar/` muestra las asignaciones del proyecto activo y las dos memorias. Los encabezados pliegan/despliegan cada sección y `/integral-sidebar` alterna la visibilidad del addon.

### Instalador

El ejecutable `integral-opencode` instala y actualiza Integral desde GitHub mediante `npx`. Copia los recursos y plugins a una ubicación persistente bajo la configuración de OpenCode; no deja enlaces al caché efímero de npm ni al checkout del repositorio. Las versiones anteriores permanecen disponibles para recuperación.

## Requisitos

- OpenCode instalado y configurado.
- Node.js 20 o posterior y npm 7 o posterior.
- Git, necesario para que npm descargue el paquete desde GitHub.
- Para `/integral-modelos`, proveedores/modelos configurados en OpenCode y catálogo disponible. Artificial Analysis es una fuente complementaria; cualquier dato inaccesible se declara como limitación.

## Instalación

```bash
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode
```

`--prefer-online` solicita a npm que compruebe si la referencia GitHub tiene una versión más reciente en lugar de confiar en una entrada cacheada. Para fijar una revisión reproducible, sustituye `main` por un tag o commit. El instalador acepta:

```bash
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode --dry-run
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode --check
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode --config-dir /ruta/a/config/opencode
```

Por defecto usa `${XDG_CONFIG_HOME:-$HOME/.config}/opencode`. `--config-dir` sirve para otra instalación/configuración aislada; para que OpenCode la utilice, inicia OpenCode con `XDG_CONFIG_HOME` apuntando al directorio padre correspondiente.

El instalador conserva comentarios y ajustes ajenos de `opencode.json(c)` y `cli.json`, conserva las memorias existentes y crea la memoria global solo si falta. Activa Integral como agente disponible, registra sus comandos y plugins, y habilita `experimental.todo` para que el agente pueda usar el checklist nativo. Si el usuario lo ha deshabilitado explícitamente, lo conserva e informa de que el checklist no estará disponible.

Los recursos activos se copian a `agents/` y `commands/`; plugins y auxiliares persistentes quedan bajo `integral/current/`, que apunta a una release copiada localmente. La actualización prepara y valida la release antes de activarla. Archivos en conflicto y configuraciones reemplazadas se respaldan en `.integral-backups/`. La instalación es repetible; `--check` valida los recursos y su configuración y `--dry-run` no escribe archivos ni descarga dependencias.

En una migración desde los enlaces creados por `install.sh`, la instalación guarda esos enlaces y cualquier archivo homónimo reemplazado en el backup. No elimina el checkout anterior, las memorias del usuario, configuraciones o recursos ajenos. Las releases previas se conservan.

Tras instalar, recarga OpenCode y ejecuta desde cada proyecto:

1. `/integral-init` para inspeccionar el proyecto, preparar `AGENTS.md`, inicializar memorias ausentes y generar asignaciones.
2. Si solo necesitas una parte: `/integral-learn` inicializa las memorias y `/integral-modelos` actualiza únicamente la tabla.

Elige Integral como agente principal. Usa `/integral-sidebar` para mostrar u ocultar el addon.

## Evaluación de modelos

`/integral-modelos` exige contexto sustantivo del proyecto. Si está vacío, primero pregunta si se quiere inicializar y espera; con aprobación prepara el mínimo necesario antes de evaluar. Luego analiza la carga pendiente por fase, pregunta qué proveedor configurado usar y compara todos sus modelos disponibles —no solo favoritos— con Artificial Analysis (`https://artificialanalysis.ai/models`) y el catálogo de OpenCode. Prioriza capacidad suficiente y ahorro de coste; el tiempo es secundario. El auxiliar Node.js `integral/current/commands/integral-modelos-data.js` limita los datos del catálogo a metadatos no sensibles. Registra fuentes y límites, no extrapola métricas entre variantes e indica confianza.

## Verificación

```bash
npm test
node --check bin/integral.js
node bin/integral.js --help
npm pack --dry-run
```

Las pruebas usan repositorios y configuraciones temporales, sin acceder a proyectos o configuraciones reales del usuario. Incluyen instalación, migración, actualización, repetición idempotente y preservación de JSONC. El chequeo del instalador verifica archivos y configuración, pero no afirma por sí solo que una instancia activa de OpenCode haya cargado los plugins.

## Seguridad

El paquete de npm solo incluye el agente, comandos, plugins, ejecutable, instalador y documentación expresamente enumerados. No incluye memorias, configuraciones globales, tokens, checkpoints ni tablas generadas por `/integral-modelos`. `.gitignore` excluye dependencias y artefactos locales.
