#!/usr/bin/env python3
"""Return sanitized configured-provider or model-catalog metadata for Integral."""

from __future__ import annotations

import json
import subprocess
import sys


def api(path: str) -> dict:
    result = subprocess.run(
        ["bash", "-c", f"opencode api get {path}"],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ValueError(f"Respuesta inesperada de {path}")
    return payload


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "providers":
        providers = api("/api/provider")["data"]
        result = [
            {
                "id": provider.get("id"),
                "name": provider.get("name"),
                "activation": provider.get("activation"),
            }
            for provider in providers
        ]
    elif len(sys.argv) == 3 and sys.argv[1] == "models":
        provider_id = sys.argv[2]
        providers = api("/api/provider")["data"]
        if not any(provider.get("id") == provider_id for provider in providers):
            raise ValueError(f"Proveedor no configurado: {provider_id}")
        models = api("/api/model")["data"]
        fields = (
            "id",
            "modelID",
            "providerID",
            "name",
            "type",
            "capabilities",
            "variants",
            "cost",
            "status",
            "enabled",
            "limit",
        )
        result = [
            {field: model.get(field) for field in fields if field in model}
            for model in models
            if model.get("providerID") == provider_id
            and model.get("type", "chat") == "chat"
            and model.get("enabled", True) is not False
            and model.get("status", "active") == "active"
        ]
    else:
        print(
            "Uso: integral-modelos-data.py providers | models PROVIDER_ID",
            file=sys.stderr,
        )
        return 2

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, ValueError) as error:
        print(f"Error al leer el catálogo de OpenCode: {error}", file=sys.stderr)
        raise SystemExit(1)
