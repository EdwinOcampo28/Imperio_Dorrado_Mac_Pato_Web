#!/usr/bin/env python3
"""Read-only checks for the reorganized Imperio Dorado project."""

from __future__ import annotations

import ast
import json
import re
import shutil
import sqlite3
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "HTML" / "index.html"
STYLESHEET = ROOT / "CSS" / "styles.css"
DATABASE = ROOT / "data" / "imperio_dorado.db"
SEED_BACKUP = ROOT / "data" / "respaldo_inicial.json"
SELECTOR_PATTERN = re.compile(r'''\$\(\s*['"`]#([A-Za-z_][\w-]*)['"`]''')
EXPECTED_MODULES = 13
EXPECTED_STYLESHEETS = 14


class RuntimeResources(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []
        self.icons: list[str] = []
        self.images: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attributes = dict(attrs)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes["src"])
        elif tag == "link" and attributes.get("href"):
            relations = attributes.get("rel", "").lower().split()
            if "stylesheet" in relations:
                self.stylesheets.append(attributes["href"])
            if "icon" in relations:
                self.icons.append(attributes["href"])
        elif tag == "img" and attributes.get("src"):
            self.images.append(attributes["src"])


def is_external(resource: str) -> bool:
    return bool(re.match(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", resource, re.I))


def local_path(resource: str) -> Path:
    clean = resource.split("?", 1)[0].split("#", 1)[0]
    return (ROOT / clean).resolve()


def report(ok: bool, message: str) -> bool:
    print(f"[{'OK' if ok else 'ERROR'}] {message}")
    return ok


def check_database() -> tuple[int, dict[str, int]] | None:
    if not DATABASE.is_file():
        report(False, "No se encontró data/imperio_dorado.db.")
        return None
    tables = {
        "movimientos": "gastos",
        "recurrentes": "recurrentes",
        "notificaciones": "notifications",
        "alertas": "alerts",
        "metas": "metas",
        "saldos pendientes": "saldos_pendientes",
        "cierres": "cierres_mensuales",
    }
    try:
        connection = sqlite3.connect(DATABASE.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        report(integrity == "ok", f"Integridad SQLite: {integrity}")
        present = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        required = set(tables.values()) | {"app_meta", "app_settings", "presupuestos"}
        tables_ok = required.issubset(present)
        report(tables_ok, "Esquema SQLite completo, incluidos los saldos pendientes independientes.")
        counts = {
            label: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for label, table in tables.items()
        }
        connection.close()
        backup_ok = False
        if SEED_BACKUP.is_file():
            try:
                backup = json.loads(SEED_BACKUP.read_text(encoding="utf-8"))
                backup_ok = isinstance(backup, dict) and isinstance(backup.get("gastos"), list)
                report(backup_ok, "Respaldo inicial JSON legible.")
            except (OSError, json.JSONDecodeError) as error:
                report(False, f"Respaldo inicial JSON: {error}")
        else:
            report(False, "No se encontró el respaldo inicial para recrear la base si hace falta.")
        print("    Registros conservados:", ", ".join(f"{name}={value}" for name, value in counts.items()))
        return (integrity == "ok" and tables_ok and backup_ok, counts)
    except sqlite3.Error as error:
        report(False, f"No se pudo leer la base SQLite: {error}")
        return None


def main() -> int:
    failures = 0
    for directory in ("Python", "JS", "CSS", "HTML", "Assets", "data"):
        failures += not report((ROOT / directory).is_dir(), f"Carpeta {directory}/")

    if not INDEX.is_file():
        report(False, "No se encontró HTML/index.html.")
        return 1

    html_text = INDEX.read_text(encoding="utf-8")
    parser = RuntimeResources()
    parser.feed(html_text)
    parser.close()
    resources = parser.stylesheets + parser.scripts + parser.icons + parser.images
    for resource in resources:
        if is_external(resource):
            continue
        path = local_path(resource)
        ok = path.is_file() and path.is_relative_to(ROOT.resolve())
        failures += not report(ok, f"Recurso de HTML/index.html: {resource}")

    active_scripts = [resource for resource in parser.scripts if not is_external(resource)]
    expected_scripts = [path.relative_to(ROOT).as_posix() for path in sorted((ROOT / "JS").glob("*.js"))]
    normalized_scripts = [Path(resource.split("?", 1)[0]).as_posix() for resource in active_scripts]
    order_ok = normalized_scripts == expected_scripts and len(expected_scripts) == EXPECTED_MODULES
    failures += not report(order_ok, f"Orden y cantidad de módulos JavaScript ({len(expected_scripts)}).")

    html_ids = set(re.findall(r"\bid\s*=\s*['\"]([^'\"]+)", html_text, re.I))
    missing_selectors = []
    for resource in active_scripts:
        source_path = local_path(resource)
        source = source_path.read_text(encoding="utf-8")
        for match in SELECTOR_PATTERN.finditer(source):
            if match.group(1) not in html_ids:
                missing_selectors.append((match.group(1), source_path.name))
    selectors_ok = not missing_selectors
    failures += not report(selectors_ok, "Selectores JavaScript estáticos presentes en HTML/index.html.")
    for selector, filename in missing_selectors:
        print(f"    Falta id #{selector}, usado en {filename}.")

    imports: list[str] = []
    if STYLESHEET.is_file():
        css_text = STYLESHEET.read_text(encoding="utf-8")
        imports = re.findall(r"@import\s+url\(\s*['\"]?([^'\")]+)", css_text, re.I)
    failures += not report(len(imports) == EXPECTED_STYLESHEETS, f"styles.css importa {len(imports)} módulos CSS.")
    for resource in imports:
        path = (STYLESHEET.parent / resource).resolve()
        ok = path.is_file() and path.is_relative_to(ROOT.resolve())
        failures += not report(ok, f"Importación CSS: {resource}")
        if ok:
            module_text = path.read_text(encoding="utf-8")
            balanced = module_text.count("{") == module_text.count("}")
            failures += not report(balanced, f"Llaves CSS equilibradas: {path.name}")

    python_files = sorted((ROOT / "Python").glob("*.py"))
    for source in python_files:
        try:
            ast.parse(source.read_text(encoding="utf-8"), filename=source.name)
            failures += not report(True, f"Sintaxis Python: {source.name}")
        except (OSError, SyntaxError) as error:
            failures += not report(False, f"Sintaxis Python: {source.name} ({error})")

    node = shutil.which("node")
    if node:
        for resource in active_scripts:
            path = local_path(resource)
            result = subprocess.run([node, "--check", str(path)], capture_output=True, text=True, check=False)
            ok = result.returncode == 0
            failures += not report(ok, f"Sintaxis JavaScript: {path.name}")
            if not ok and result.stderr:
                print(result.stderr.rstrip())
    else:
        print("[AVISO] Node.js no está instalado; se omitió la comprobación de sintaxis JS.")

    database_result = check_database()
    failures += database_result is None or not database_result[0]
    if failures:
        print(f"\nRevisión terminada: {failures} problema(s).")
        return 1
    print("\nRevisión terminada sin errores en rutas, módulos ni base SQLite.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
