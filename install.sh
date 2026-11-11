#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
CONFIG_DIR="${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}"
while (($#)); do
  case "$1" in
    --config-dir) (($# >= 2)) || { echo "Falta ruta para --config-dir" >&2; exit 2; }; CONFIG_DIR="$2"; shift 2 ;;
    -h|--help) echo "Uso: ./install.sh [--config-dir RUTA]"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done
CONFIG_DIR="$(mkdir -p "$CONFIG_DIR" && cd "$CONFIG_DIR" && pwd -P)"
[[ "$CONFIG_DIR" != "$ROOT" && "$CONFIG_DIR" != "$ROOT"/* ]] || { echo "No instales dentro del repositorio." >&2; exit 1; }

python3 - "$ROOT" "$CONFIG_DIR" <<'PY'
import json, os, shutil, stat, sys, tempfile
from datetime import datetime
from pathlib import Path

root, cfg = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
assets = ["agents/integral.md", "commands/integral-modelos.md", "commands/integral-learn.md", "commands/integral-learn-init.py",
          "plugins/integral-model-switch", "plugins/integral-sidebar"]
backup = cfg / ".integral-backups" / datetime.now().strftime("%Y%m%d-%H%M%S")
made_backup = False

def save_conflict(dest):
    global made_backup
    if dest.exists() or dest.is_symlink():
        target = backup / "files" / dest.relative_to(cfg)
        target.parent.mkdir(parents=True, exist_ok=True)
        if dest.is_dir() and not dest.is_symlink(): shutil.copytree(dest, target)
        else: shutil.copy2(dest, target, follow_symlinks=False)
        dest.unlink() if dest.is_symlink() or dest.is_file() else shutil.rmtree(dest)
        made_backup = True

for item in assets:
    src, dest = root / item, cfg / item
    if not src.exists(): raise SystemExit(f"Falta archivo Integral: {src}")
    if dest.is_symlink() and dest.resolve() == src.resolve(): continue
    save_conflict(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.symlink_to(src, target_is_directory=src.is_dir())

def strip_jsonc(text):
    out=[]; i=0; string=False; escape=False
    while i<len(text):
        c=text[i]; n=text[i+1] if i+1<len(text) else ""
        if string:
            out.append(c)
            if escape: escape=False
            elif c=="\\": escape=True
            elif c=='"': string=False
            i+=1; continue
        if c=='"': string=True; out.append(c); i+=1; continue
        if c=="/" and n=="/":
            i+=2
            while i<len(text) and text[i] not in "\r\n": i+=1
            continue
        if c=="/" and n=="*":
            i+=2
            while i+1<len(text) and text[i:i+2]!="*/": i+=1
            i+=2; continue
        out.append(c); i+=1
    text="".join(out)
    # Remove trailing commas outside quoted strings.
    out=[]; i=0; string=False; escape=False
    while i<len(text):
        c=text[i]
        if string:
            out.append(c)
            if escape: escape=False
            elif c=="\\": escape=True
            elif c=='"': string=False
            i+=1; continue
        if c=='"': string=True; out.append(c); i+=1; continue
        if c==",":
            j=i+1
            while j<len(text) and text[j].isspace(): j+=1
            if j<len(text) and text[j] in "]}": i+=1; continue
        out.append(c); i+=1
    return "".join(out)

def merge_config(name, transform):
    path=cfg/name
    if path.exists():
        original=path.read_text(encoding="utf-8")
        data=json.loads(strip_jsonc(original))
        mode=stat.S_IMODE(path.stat().st_mode)
    else: data={}; original=None; mode=0o600
    if not isinstance(data,dict): raise SystemExit(f"{path}: la raíz debe ser objeto JSON")
    transform(data)
    text=json.dumps(data,ensure_ascii=False,indent=2)+"\n"
    if original is not None and json.loads(strip_jsonc(original))==data: return
    if path.exists():
        target=backup/"files"/name; target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(path,target); global made_backup; made_backup=True
    fd,tmp=tempfile.mkstemp(prefix=f".{name}.",dir=cfg)
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as f: f.write(text)
        os.chmod(tmp,mode); os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def server(d):
    ins=d.setdefault("instructions",[])
    if not isinstance(ins,list): raise SystemExit("opencode config: instructions debe ser una lista")
    for x in (str(cfg/"LEARN.md"), ".opencode/LEARN.md"):
        if x not in ins: ins.append(x)
    agents=d.setdefault("agents",{}); integral=agents.setdefault("integral",{})
    integral.update({"mode":"primary","color":"#14b8a6"})
    plugins=d.setdefault("plugins",[]); entry="./plugins/integral-model-switch"
    if entry not in plugins: plugins.append(entry)

def cli(d):
    plugins=d.setdefault("plugins",[]); entry={"package":"./plugins/integral-sidebar"}
    if not any(x==entry or x==entry["package"] for x in plugins): plugins.append(entry)

json_files=[x for x in ("opencode.jsonc","opencode.json") if (cfg/x).exists()]
if len(json_files)>1: raise SystemExit("Hay opencode.json y opencode.jsonc; resuelve el duplicado antes de instalar.")
merge_config(json_files[0] if json_files else "opencode.jsonc",server)
merge_config("cli.json",cli)
print(f"Integral instalado en {cfg}")
if made_backup: print(f"Archivos reemplazados respaldados en {backup}")
print("Recarga OpenCode para activar los plugins. Usa /integral-modelos y /integral-sidebar.")
PY
