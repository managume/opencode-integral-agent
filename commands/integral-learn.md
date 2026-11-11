---
description: Inicializa las memorias global y del proyecto sin sobrescribirlas
agent: integral
subagent: false
---

Inicializa ambas memorias usando el inicializador del paquete:

!`python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-learn-init.py"`

El inicializador usa la raíz Git (o el directorio actual si no hay Git), crea únicamente los archivos ausentes con creación exclusiva y deja intactos incluso los enlaces simbólicos. Resume los resultados mostrados por el inicializador; si indica un error, no afirmes que ambas memorias quedaron listas.

No copies preferencias entre ámbitos. La global es para criterios generales; la local pertenece al proyecto. Este comando inicializa archivos, no añade preferencias automáticamente.
