#!/usr/bin/env python3
"""SQLite persistence for the Imperio Dorado local finance app.

Only Python's standard library is required. The database is stored in data/.
"""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATABASE_PATH = DATA_DIR / "imperio_dorado.db"
DEFAULT_BACKUP = DATA_DIR / "respaldo_inicial.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gastos (
    row_order INTEGER PRIMARY KEY,
    movement_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    movement_type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    movement_date TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recurrentes (
    row_order INTEGER PRIMARY KEY,
    recurring_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL,
    next_date TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
    row_order INTEGER PRIMARY KEY,
    notification_id TEXT NOT NULL,
    date TEXT NOT NULL,
    is_read INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
    row_order INTEGER PRIMARY KEY,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS presupuestos (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    monthly_limit REAL NOT NULL,
    categories_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS metas (
    row_order INTEGER PRIMARY KEY,
    goal_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    target REAL NOT NULL,
    saved REAL NOT NULL,
    target_date TEXT NOT NULL,
    contributions_json TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saldos_pendientes (
    row_order INTEGER PRIMARY KEY,
    pending_id INTEGER NOT NULL,
    person TEXT NOT NULL,
    amount REAL NOT NULL,
    paid REAL NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cierres_mensuales (
    row_order INTEGER PRIMARY KEY,
    month TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
"""


def _open(db_path: Path = DATABASE_PATH) -> sqlite3.Connection:
    db_path = Path(db_path)
    if str(db_path) != ":memory:":
        db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(db_path), timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 15000")
    return connection


def create_schema(db_path: Path = DATABASE_PATH) -> None:
    connection = _open(db_path)
    try:
        connection.executescript(SCHEMA)
        if str(db_path) != ":memory:":
            connection.execute("PRAGMA journal_mode = WAL")
    finally:
        connection.close()


def _dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _load_records(connection: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    return [json.loads(row[0]) for row in connection.execute(
        f"SELECT payload_json FROM {table} ORDER BY row_order"
    )]


def _number(value: Any, fallback: float = 0) -> float:
    try:
        result = float(value)
        return result if math.isfinite(result) else fallback
    except (TypeError, ValueError):
        return fallback


def _id(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return fallback


def load_state(db_path: Path = DATABASE_PATH) -> dict[str, Any]:
    connection = _open(db_path)
    try:
        settings = {
            row["key"]: json.loads(row["value_json"])
            for row in connection.execute("SELECT key, value_json FROM app_settings")
        }
        budget_row = connection.execute(
            "SELECT monthly_limit, categories_json FROM presupuestos WHERE singleton = 1"
        ).fetchone()
        budgets = (
            {"mensual": budget_row["monthly_limit"], "categorias": json.loads(budget_row["categories_json"])}
            if budget_row
            else {"mensual": 0, "categorias": {}}
        )
        return {
            "gastos": _load_records(connection, "gastos"),
            "recurrentes": _load_records(connection, "recurrentes"),
            "notifications": _load_records(connection, "notifications"),
            "config": settings.get("config", {}),
            "alerts": _load_records(connection, "alerts"),
            "presupuestos": budgets,
            "metas": _load_records(connection, "metas"),
            "pendientes": _load_records(connection, "saldos_pendientes"),
            "cierres": _load_records(connection, "cierres_mensuales"),
        }
    finally:
        connection.close()


def save_state(state: dict[str, Any], db_path: Path = DATABASE_PATH) -> None:
    if not isinstance(state, dict):
        raise ValueError("El estado recibido debe ser un objeto JSON.")
    names = ("gastos", "recurrentes", "notifications", "alerts", "metas", "pendientes", "cierres")
    for name in names:
        if name in state and not isinstance(state[name], list):
            raise ValueError(f"La sección {name} debe ser una lista.")
    budgets = state.get("presupuestos", {"mensual": 0, "categorias": {}})
    config = state.get("config", {})
    if not isinstance(budgets, dict) or not isinstance(budgets.get("categorias", {}), dict):
        raise ValueError("La sección de presupuestos no tiene un formato válido.")
    if not isinstance(config, dict):
        raise ValueError("La configuración debe ser un objeto.")

    expenses = state.get("gastos", [])
    recurring = state.get("recurrentes", [])
    notifications = state.get("notifications", [])
    alerts = state.get("alerts", [])
    goals = state.get("metas", [])
    pending = state.get("pendientes", [])
    closures = state.get("cierres", [])
    connection = _open(db_path)
    try:
        connection.executescript(SCHEMA)
        with connection:
            for table in ("gastos", "recurrentes", "notifications", "alerts", "metas", "saldos_pendientes", "cierres_mensuales", "app_settings", "presupuestos"):
                connection.execute(f"DELETE FROM {table}")

            for order, item in enumerate(expenses):
                if not isinstance(item, dict):
                    raise ValueError("Cada movimiento debe ser un objeto.")
                connection.execute(
                    "INSERT INTO gastos VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (order, _id(item.get("id"), order + 1), _number(item.get("monto")),
                     str(item.get("tipo", "gasto")), str(item.get("categoria", "Otros")),
                     str(item.get("descripcion", "")), str(item.get("fecha", "")), _dump(item)),
                )

            for order, item in enumerate(recurring):
                if not isinstance(item, dict):
                    raise ValueError("Cada gasto recurrente debe ser un objeto.")
                connection.execute(
                    "INSERT INTO recurrentes VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (order, _id(item.get("id"), order + 1), str(item.get("nombre", "")),
                     _number(item.get("monto")), str(item.get("categoria", "Otros")),
                     str(item.get("frecuencia", "monthly")), str(item.get("proximaFecha", "")), _dump(item)),
                )

            for order, item in enumerate(notifications):
                if not isinstance(item, dict):
                    raise ValueError("Cada notificación debe ser un objeto.")
                connection.execute(
                    "INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (order, str(item.get("id", order + 1)), str(item.get("fecha", "")),
                     int(bool(item.get("leida", False))), str(item.get("title", "")),
                     str(item.get("message", "")), str(item.get("type", "info")), _dump(item)),
                )

            for order, item in enumerate(alerts):
                if not isinstance(item, dict):
                    raise ValueError("Cada alerta debe ser un objeto.")
                connection.execute("INSERT INTO alerts VALUES (?, ?)", (order, _dump(item)))

            connection.execute("INSERT INTO app_settings VALUES (?, ?)", ("config", _dump(config)))
            monthly_limit = max(0, _number(budgets.get("mensual")))
            connection.execute(
                "INSERT INTO presupuestos VALUES (1, ?, ?)",
                (monthly_limit, _dump(budgets.get("categorias", {}))),
            )

            for order, item in enumerate(goals):
                if not isinstance(item, dict):
                    raise ValueError("Cada meta debe ser un objeto.")
                contributions = item.get("aportes", [])
                if not isinstance(contributions, list):
                    contributions = []
                connection.execute(
                    "INSERT INTO metas VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (order, _id(item.get("id"), order + 1), str(item.get("nombre", "")),
                     _number(item.get("objetivo")), _number(item.get("ahorrado")),
                     str(item.get("fecha", "")), _dump(contributions), _dump(item)),
                )

            for order, item in enumerate(pending):
                if not isinstance(item, dict):
                    raise ValueError("Cada saldo pendiente debe ser un objeto.")
                connection.execute(
                    "INSERT INTO saldos_pendientes VALUES (?, ?, ?, ?, ?, ?)",
                    (order, _id(item.get("id"), order + 1), str(item.get("persona", "")),
                     _number(item.get("monto")), _number(item.get("abonado")), _dump(item)),
                )

            for order, item in enumerate(closures):
                if not isinstance(item, dict):
                    raise ValueError("Cada cierre mensual debe ser un objeto.")
                connection.execute(
                    "INSERT INTO cierres_mensuales VALUES (?, ?, ?)",
                    (order, str(item.get("mes", "")), _dump(item)),
                )
            connection.execute(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initialized', '1')"
            )
    finally:
        connection.close()


def _backup_state(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict) or not isinstance(value.get("gastos"), list):
        raise ValueError("El respaldo debe contener una lista de movimientos llamada 'gastos'.")
    return {
        "gastos": value.get("gastos", []),
        "recurrentes": value.get("recurrentes", []),
        "notifications": value.get("notifications", []),
        "config": value.get("config", {}),
        "alerts": value.get("alerts", []),
        "presupuestos": value.get("presupuestos", {"mensual": 0, "categorias": {}}),
        "metas": value.get("metas", []),
        "pendientes": value.get("pendientes", []),
        "cierres": value.get("cierres", []),
    }


def is_initialized(db_path: Path = DATABASE_PATH) -> bool:
    connection = _open(db_path)
    try:
        exists = connection.execute(
            "SELECT 1 FROM app_meta WHERE key = 'initialized' AND value = '1'"
        ).fetchone()
        return exists is not None
    finally:
        connection.close()


def initialize_database(
    db_path: Path = DATABASE_PATH,
    seed_path: Path | None = DEFAULT_BACKUP,
) -> bool:
    create_schema(db_path)
    if is_initialized(db_path):
        return False
    if seed_path is not None and Path(seed_path).is_file():
        save_state(_backup_state(Path(seed_path)), db_path)
    else:
        save_state({}, db_path)
    return True


def summary(db_path: Path = DATABASE_PATH) -> dict[str, int]:
    connection = _open(db_path)
    try:
        tables = {
            "movimientos": "gastos",
            "recurrentes": "recurrentes",
            "notificaciones": "notifications",
            "alertas": "alerts",
            "metas": "metas",
            "saldos pendientes": "saldos_pendientes",
            "cierres": "cierres_mensuales",
        }
        return {label: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for label, table in tables.items()}
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Administra la base SQLite de Imperio Dorado.")
    parser.add_argument("--db", type=Path, default=DATABASE_PATH, help="Ruta de la base SQLite.")
    parser.add_argument("--import", dest="import_path", type=Path, help="Importa y reemplaza datos desde un respaldo JSON.")
    parser.add_argument("--init", action="store_true", help="Crea la base si todavía no existe.")
    parser.add_argument("--summary", action="store_true", help="Muestra cuántos registros tiene cada tabla.")
    args = parser.parse_args()

    try:
        if args.import_path:
            create_schema(args.db)
            save_state(_backup_state(args.import_path), args.db)
            print(f"Respaldo importado a: {args.db}")
        else:
            created = initialize_database(args.db)
            print(f"Base de datos: {args.db}")
            print("Inicializada desde el respaldo incluido." if created else "La base ya estaba inicializada; no se modificó.")
        if args.summary:
            for name, count in summary(args.db).items():
                print(f"{name}: {count}")
    except (OSError, sqlite3.Error, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
