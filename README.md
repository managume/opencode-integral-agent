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

`install.sh` enlaza agente, comandos y plugins y fusiona solo los ajustes de activación necesarios en la configuración OpenCode que ya exista. No instala memorias ni asignaciones generadas: inicialízalas con `/integral-init` (todo junto), o por separado con `/integral-learn` y `/integral-modelos`.

## Requisitos

- OpenCode instalado y configurado.
- Bash y Python 3.
- Para `/integral-modelos`, proveedores/modelos configurados en OpenCode y catálogo disponible. Artificial Analysis es una fuente complementaria; cualquier dato inaccesible se declara como limitación.

## Instalación

```bash
./install.sh
```

Por defecto usa `${XDG_CONFIG_HOME:-$HOME/.config}/opencode`. Para otra instancia:

```bash
./install.sh --config-dir /ruta/a/config/opencode
# O bien:
OPENCODE_CONFIG_DIR=/ruta/a/config/opencode ./install.sh
```

El instalador conserva los ajustes ajenos, registra las rutas global y local de LEARN y enlaza los recursos del paquete. Si una ruta de recurso ya existe y no apunta al repositorio, guarda una copia en `.integral-backups/` antes de enlazarla. Es idempotente; mantén el repositorio disponible mientras OpenCode use esos enlaces. No crea ni modifica `LEARN.md` o el `AGENTS.md` de ningún usuario/proyecto.

Tras instalar, recarga OpenCode y ejecuta desde cada proyecto:

1. `/integral-init` para inspeccionar el proyecto, preparar `AGENTS.md`, inicializar memorias ausentes y generar asignaciones.
2. Si solo necesitas una parte: `/integral-learn` inicializa las memorias y `/integral-modelos` actualiza únicamente la tabla.

Elige Integral como agente principal. Usa `/integral-sidebar` para mostrar u ocultar el addon.

## Evaluación de modelos

`/integral-modelos` exige contexto sustantivo del proyecto. Si está vacío, primero pregunta si se quiere inicializar y espera; con aprobación prepara el mínimo necesario antes de evaluar. Luego analiza la carga pendiente por fase, pregunta qué proveedor configurado usar y compara todos sus modelos disponibles —no solo favoritos— con Artificial Analysis (`https://artificialanalysis.ai/models`) y el catálogo de OpenCode. Prioriza capacidad suficiente y ahorro de coste; el tiempo es secundario. El auxiliar `commands/integral-modelos-data.py` limita los datos del catálogo a metadatos no sensibles. Registra fuentes y límites, no extrapola métricas entre variantes e indica confianza.

## Verificación

```bash
bash -n install.sh
./install.sh --help
python3 -m py_compile commands/integral-learn-init.py
python3 -m unittest discover -s tests -v
```

Prueba instalaciones en un directorio temporal; nunca uses una configuración de usuario real para las pruebas. Las pruebas de continuidad comprueban reglas clave y mecánicas Git con repositorios desechables, sin acceder a proyectos del usuario. No simulan una sesión de modelo ni pueden garantizar que la plataforma mantenga un turno abierto o preserve herramientas tras un límite forzado.

## Seguridad

`.gitignore` es una lista permitida y excluye por defecto los archivos que no forman parte del paquete, además de claves, credenciales, `.env`, dependencias y artefactos. No agregues memorias de usuario/proyecto, configuraciones globales, tokens ni tablas generadas por `/integral-modelos`.
