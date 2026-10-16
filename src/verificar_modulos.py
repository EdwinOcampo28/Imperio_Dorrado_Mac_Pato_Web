#!/usr/bin/env python3
"""Reconstruye copias de index.html y app.js desde los fragmentos fuente.
Los archivos originales operativos se conservan sin cambios; estos módulos son una organización de mantenimiento.
"""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
# Los fragmentos JS están ordenados y concatenan exactamente el app.js original.
js_dir = root / "src" / "js"
js = "".join((js_dir / name).read_text(encoding="utf-8") for name in [
    "01_app_fragmento.js",
    "02_app_fragmento.js",
    "03_app_fragmento.js",
    "04_app_fragmento.js",
    "05_app_fragmento.js",
    "06_app_fragmento.js",
])
original = root / "static" / "app.js"
if js != original.read_text(encoding="utf-8"):
    raise SystemExit("ERROR: los fragmentos JS no reconstruyen exactamente static/app.js")
print("OK: los fragmentos JS reconstruyen exactamente static/app.js")
print("Las secciones HTML están disponibles en src/html; index.html operativo se conserva intacto.")
