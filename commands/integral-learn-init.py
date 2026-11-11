#!/usr/bin/env python3
"""Create missing global and project Integral LEARN files without overwriting."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path


GLOBAL_TEMPLATE = """# Memoria global de procedimiento

Preferencias generales y duraderas de colaboración. No guardar datos sensibles ni detalles técnicos de proyectos.

## Preferencias
"""

PROJECT_TEMPLATE = """# Memoria del proyecto

Preferencias de colaboración nacidas de los requisitos o del flujo de este proyecto. Los detalles técnicos pertenecen a la documentación del proyecto.

## Preferencias
"""


def project_root(cwd: Path) -> Path:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
        return Path(result.stdout.strip()).resolve()
    except (OSError, subprocess.CalledProcessError):
        return cwd


def create_if_missing(path: Path, content: str) -> str:
    # A symlink (including a broken one) is user-managed; never replace it.
    if path.exists() or path.is_symlink():
        return "ya existía; conservada"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x", encoding="utf-8") as stream:
            stream.write(content)
        return "inicializada"
    except FileExistsError:
        return "creada por otra ejecución; conservada"
    except OSError as error:
        return f"error: {error}"


def main() -> int:
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")).expanduser()
    global_path = config_home / "opencode" / "LEARN.md"
    root = project_root(Path.cwd().resolve())
    project_path = root / ".opencode" / "LEARN.md"

    outcomes = [
        ("Global", global_path, create_if_missing(global_path, GLOBAL_TEMPLATE)),
        ("Proyecto", project_path, create_if_missing(project_path, PROJECT_TEMPLATE)),
    ]
    for scope, path, outcome in outcomes:
        print(f"{scope}: {path} — {outcome}")
    return int(any(outcome.startswith("error:") for _, _, outcome in outcomes))


if __name__ == "__main__":
    raise SystemExit(main())
