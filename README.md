# Integral para OpenCode

Integral es un agente de OpenCode con flujo de colaboración por fases, memoria global y por proyecto, evaluación de modelos, cambio de modelo/variante y un addon informativo para la TUI. Este repositorio es el paquete fuente y el instalador para habilitar esas funciones en instancias OpenCode elegidas por el usuario.

## Contenido

- `agents/integral.md`: flujo de trabajo del agente y uso de memorias y asignaciones por fase.
- `LEARN.md`: memoria global de colaboración.
- `commands/integral-modelos.md`: comando `/integral-modelos`; evalúa favoritos disponibles, consulta Artificial Analysis cuando hay datos, y actualiza siempre la sección delimitada de `AGENTS.md` del proyecto activo.
- `plugins/integral-model-switch/`: plugin servidor que proporciona `set_integral_phase`.
- `plugins/integral-sidebar/`: plugin TUI con asignaciones y memorias, encabezados plegables y comando `/integral-sidebar` para mostrar/ocultar el addon.
- `opencode.jsonc` y `cli.json`: configuración activa de esta instancia de referencia. El instalador no copia estos archivos tal cual: mezcla solo los ajustes necesarios en la configuración destino.
- `install.sh`: instalador con destino configurable, enlaces a los recursos versionados, fusión de configuración y copias de seguridad.

## Requisitos

- OpenCode instalado y configurado en el usuario destino.
- Bash, Python 3 y permisos de escritura en el directorio de configuración.
- Para `/integral-modelos`: favoritos y catálogo disponibles en esa ubicación; acceso web a Artificial Analysis es complementario. La falta de acceso se documenta en el resultado, no se inventan métricas.

## Instalar

Desde una copia local del repositorio:

```bash
./install.sh
```

El destino por defecto es `${XDG_CONFIG_HOME:-$HOME/.config}/opencode`. El instalador fusiona `opencode.jsonc`, o `opencode.json` si ese es el archivo existente; si encuentra ambos, se detiene para evitar una configuración ambigua. Para desplegar en otra instancia/configuración:

```bash
./install.sh --config-dir /ruta/a/otra/config/opencode
# Alternativamente:
OPENCODE_CONFIG_DIR=/ruta/a/otra/config/opencode ./install.sh
```

El instalador enlaza los recursos del paquete, por lo que mantener el repositorio disponible es necesario. Añade las instrucciones y entradas de plugins de Integral sin reemplazar claves ajenas en `opencode.jsonc` y `cli.json`. Si una ruta de recurso ya existe y no apunta al paquete, la respalda bajo `.integral-backups/` y la sustituye por el enlace. Las configuraciones JSONC se fusionan y se escriben como JSON válido. La instalación es idempotente. Revisa el directorio de respaldos antes de borrar cualquier copia.

Tras instalar, inicia o recarga OpenCode. Para desinstalar, elimina las entradas específicas de Integral de ambas configuraciones y los enlaces de Integral en el destino; no borres archivos de respaldo sin revisarlos. El paquete original permanece intacto.

## Uso

1. Selecciona `integral` como agente principal.
2. Ejecuta `/integral-modelos` desde el proyecto para evaluar modelos favoritos y refrescar la sección `MODELS-PROJECT` del `AGENTS.md` raíz de ese proyecto.
3. El agente consulta esa tabla para cambiar entre las fases `analysis` y `development`; el plugin valida que modelo/variante estén disponibles.
4. Usa `/integral-sidebar` para alternar el addon. Haz clic en cada encabezado para plegar o desplegar su sección.

El sidebar presenta, en este orden, modelos por fase, `.opencode/LEARN.md` del proyecto y `LEARN.md` global. Las memorias específicas permanecen dentro de cada proyecto y no son desplegadas ni sustituidas por el instalador.

## Evaluación de modelos y evidencia

`/integral-modelos` solo asigna modelos favoritos que estén disponibles en el catálogo actual de OpenCode. Para cada evaluación debe actualizar `AGENTS.md`, incluso si las asignaciones no cambian. Artificial Analysis es una fuente complementaria de índices/benchmarks, coste y rendimiento: registrar enlaces, variante y fecha; comparar evidencia pertinente; distinguir los resultados de benchmark del rendimiento esperado en el proyecto; y dejar claras discrepancias de modalidad, contexto, coste o proveedor. Si faltan datos, anotar el límite en lugar de extrapolar. La asignación final debe incluir confianza y justificación breve.

## Seguridad y publicación

El `.gitignore` utiliza una lista permitida: únicamente se versionan los archivos Integral enumerados. Lo demás queda excluido por defecto; además se ignoran credenciales, claves, archivos `.env`, dependencias, cachés, logs y artefactos. Antes de publicar, revisa especialmente `opencode.jsonc`, `cli.json`, instrucciones y memorias: aunque el instalador no los replica completos, los archivos de referencia pueden reflejar preferencias propias. Nunca agregues tokens, claves privadas, datos de cuenta ni memorias específicas de otros proyectos.

## Desarrollo y verificación

```bash
bash -n install.sh
./install.sh --help
```

Para probar una instalación aislada, usa un directorio temporal como `--config-dir /tmp/opencode-integral-test` y comprueba enlaces, fusión, respaldos e idempotencia. No ejecutes la prueba apuntando a una configuración de usuario real.
