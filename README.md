# Integral para OpenCode

Integral es un agente principal para dirigir y entregar proyectos en OpenCode. El repositorio distribuye el agente y su instalador, no memorias personales, checkpoints ni configuración específica de una instancia.

## Trabajo autónomo

El agente puede analizar requisitos, planificar, diseñar, desarrollar, delegar selectivamente, verificar, documentar y recuperar trabajo en curso sin exigir que se invoquen comandos para cada operación. Los checkpoints se guardan en `.opencode/checkpoints/`; el agente reutiliza planes, pruebas y LEARN existentes y verifica el estado real antes de reanudar.

La calidad es progresiva: cambios pequeños reciben checks focalizados; hitos funcionales, integración y regresiones pertinentes; versiones finales, validación más amplia cuando la aplicación y el riesgo lo justifiquen. Cambios críticos se verifican antes de avanzar. Playwright y E2E no son automáticos para cada tarea. Integral conserva la integración final de todo trabajo delegado y exige worktrees separados para escritores paralelos.

Una petición de desarrollo autoriza el ciclo completo dentro del alcance acordado: implementación, comprobaciones pertinentes, corrección de fallos recuperables y nueva verificación. Integral no debe pedir «continúa» entre fases ni detenerse en una actualización de progreso cuando quedan acciones autorizadas. Pregunta solo ante una decisión material, autorización o límite de seguridad; las paradas por límites reales de la plataforma se describen con evidencia y con el trabajo pendiente identificado.

## Objetivos persistentes de OpenCode

Integral usa el `/goal` nativo de OpenCode cuando un hito funcional de varios pasos o un refactor acotado se beneficia de continuar y revisar automáticamente. Las correcciones pequeñas, tareas breves y claras, auditorías de solo lectura y exploración siguen el flujo normal. El usuario puede iniciar `/goal <objetivo>` expresamente en cualquier momento. Cada objetivo debe delimitar resultado, alcance, criterios verificables, prohibiciones, finalización y tratamiento de bloqueos; divide iniciativas grandes en hitos.

Integral sigue siendo responsable del trabajo y de sus pruebas. `/goal` solo administra continuidad y revisión automática: no reemplaza pruebas ni crea una segunda checklist, bucle, plugin o revisor. No se inicia un objetivo por cada petición ni en las sesiones hijas. Si el runtime permite la interfaz actual de comandos de sesión, Integral puede iniciar el comando nativo con el ID de la sesión actual; si no, ofrece el objetivo exacto para que el usuario lo invoque, sin afirmar que quedó activado.

En OpenCode 2.3.0 se comprobaron un máximo nativo de 50 rondas, pausa tras tres señales de estancamiento, y los comandos `pause`, `resume` y `clear`. Estos valores no configuran una cuota de tokens. Integral no fija un tope artificial de pasos por respuesta: OpenCode puede imponer límites de plataforma, contexto, proveedor o sesión y deben comunicarse solo cuando se observen. No hay en la interfaz revisada un límite configurable de rondas ni una cuota física del proveedor. Si se requiere un corte estricto por coste, hace falta un límite externo del proveedor o un supervisor autorizado; Integral no cambia de modelo ni de API facturable automáticamente.

El estado activo de `/goal` pertenece a la sesión: un reinicio del servidor lo pausa y no garantiza continuidad tras apagar el equipo. Los checkpoints conservan evidencia de proyecto para recuperación independiente; al reanudar se comprueban Git, archivos y pruebas, sin duplicar el estado del objetivo. `/goal pause` y `/goal clear` no garantizan interrumpir una operación ya activa; ante una orden explícita de detenerse, Integral pausa/elimina el objetivo y usa la interrupción nativa de sesión cuando corresponda.

## Comandos opcionales

| Comando | Uso |
|---|---|
| `/integral-start` | Preparar o reconocer un proyecto nuevo o existente. Es idempotente; el trabajo normal no depende de ejecutarlo. |
| `/integral-audit` | Auditar riesgos y mejoras con inspección de solo lectura. |
| `/integral-release` | Preparar y verificar un hito para revisión humana; no lo publica. |
| `/integral-doctor` | Diagnosticar Integral y aplicar únicamente reparaciones seguras y autorizadas. |

La memoria LEARN y la selección de modelos son capacidades internas: se reutilizan cuando son pertinentes. Integral preserva la configuración de modelos, las memorias y los datos del usuario. No realiza investigación externa recurrente ni modifica la configuración global de modelos sin petición explícita.

Las memorias se encuentran en:

- Global: `${XDG_CONFIG_HOME:-$HOME/.config}/opencode/LEARN.md`.
- Proyecto: `<raíz-del-proyecto>/.opencode/LEARN.md`.

El plugin de cambio de modelo aplica asignaciones ya definidas en el `AGENTS.md` del proyecto. OpenCode proporciona la checklist nativa; Integral no instala una UI de seguimiento paralela.

## Requisitos e instalación

- OpenCode, Node.js 20 o posterior, npm 7 o posterior y Git.

```bash
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode
```

El instalador persistente acepta `--dry-run`, `--check`, `--uninstall` y `--config-dir <path>`. La configuración alternativa se usa con OpenCode cuando `XDG_CONFIG_HOME` apunta a su directorio padre.

```bash
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode --dry-run
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode --check
npx --yes --prefer-online --package=github:managume/opencode-integral-agent#main integral-opencode --uninstall
```

Las releases se copian bajo la configuración de OpenCode, sin depender del caché de npm ni de un checkout. La instalación reemplaza los comandos antiguos, conserva sus copias en `.integral-backups/` y quita la configuración del sidebar. `--uninstall` respalda los archivos retirados y elimina las referencias de Integral sin borrar LEARN, checkpoints ni plugins ajenos. Si una versión anterior no tiene registro de propiedad, deja intactos los valores de configuración ambiguos y lo advierte. Los comentarios y ajustes no relacionados se conservan.

## Verificación de este repositorio

```bash
npm test
node bin/integral.js --help
npm pack --dry-run
```

Las pruebas cubren actualización desde la interfaz anterior, instalación repetida, desinstalación segura, configuración JSONC, detección de comandos y agente en OpenCode, preservación de datos y la política de uso de `/goal`. No se atribuyen ahorros de tokens sin mediciones fiables; se pueden comparar tiempo, llamadas o checks cuando exista evidencia directa.

## Seguridad y alcance

Las auditorías son de solo lectura. Preparar una entrega no la publica. El médico no reinstala ni elimina datos de forma implícita. La lista de archivos de npm es explícita y excluye memorias, configuración local, credenciales y checkpoints. Integral dirige un solo proyecto; no implementa un gestor global ni coordinación multiproyecto.
