#!/usr/bin/env python3
"""Tooling for the per-motor database layout.

Source of truth: motors/<Manufacturer>/<Motor>.json (one motor per file).
database.json is generated from those files and is what the website loads.

Usage:
    python3 scripts/motordb.py validate  # validate motors/ only
    python3 scripts/motordb.py build   # validate motors/ and write database.json
    python3 scripts/motordb.py check   # validate motors/ and fail if database.json is stale
    python3 scripts/motordb.py split   # rewrite motors/ from database.json (e.g. after an Excel round-trip)

Standard library only.
"""
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

ROOT = Path(__file__).resolve().parent.parent
MOTORS_DIR = ROOT / "motors"
DATABASE = ROOT / "database.json"
SCHEMA = ROOT / "motor.schema.json"
GENERIC_PAGES = {"index", "pd", "product", "item", "goods"}


def load_schema():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    return schema, list(schema["properties"].keys())


def slug(text):
    """Turn arbitrary text into a safe file/folder name."""
    text = unicodedata.normalize("NFKC", text).strip()
    text = re.sub(r"[^A-Za-z0-9.+_-]+", "_", text)
    return re.sub(r"_+", "_", text).strip("._-")


def manufacturer_dir(motor):
    return slug(motor["Manufacturer"]) or "Unknown"


def motor_filename(motor):
    name, kv = motor.get("Name", ""), motor.get("KV (RPM/V)", "")
    if not name:
        # Placeholder entries without a name: derive one from the product link.
        url = urlsplit(motor.get("Link", ""))
        name = re.sub(r"\.(html?|php|jsp|aspx?)$", "", url.path.rstrip("/").rsplit("/", 1)[-1])
        if name.lower() in GENERIC_PAGES:
            # e.g. index.php?product_id=1811 or pd.jsp?id=137: the id is the only identifier
            ids = [v for k, v in parse_qsl(url.query) if k.lower().endswith("id")]
            name = f"{name}-{ids[-1]}" if ids else name
    base = slug(name)[:80].rstrip("._-") or "motor"
    if kv:
        base += f"-{slug(kv)}KV"
    return base


def dump(obj):
    return json.dumps(obj, indent=4, ensure_ascii=False) + "\n"


def validate(motor, keys, schema, where):
    errors = []
    if not isinstance(motor, dict):
        return [f"{where}: expected a JSON object"]
    missing = [k for k in keys if k not in motor]
    extra = [k for k in motor if k not in keys]
    if missing:
        errors.append(f"{where}: missing fields {missing}")
    if extra:
        errors.append(f"{where}: unknown fields {extra} (add them to motor.schema.json first)")
    for k, v in motor.items():
        if k in keys and not isinstance(v, str):
            errors.append(f"{where}: field {k!r} must be a string")
    for k, prop in schema["properties"].items():
        if prop.get("minLength") and isinstance(motor.get(k), str) and len(motor[k]) < prop["minLength"]:
            errors.append(f"{where}: field {k!r} must not be empty")
    return errors


def collect():
    schema, keys = load_schema()
    motors, errors = [], []
    for path in sorted(MOTORS_DIR.glob("*/*.json"), key=lambda p: (p.parent.name.lower(), p.name.lower())):
        rel = path.relative_to(ROOT).as_posix()
        try:
            motor = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{rel}: invalid JSON ({e})")
            continue
        errs = validate(motor, keys, schema, rel)
        if not errs and manufacturer_dir(motor) != path.parent.name:
            errs.append(f"{rel}: Manufacturer {motor['Manufacturer']!r} belongs in motors/{manufacturer_dir(motor)}/")
        errors += errs
        if not errs:
            motors.append({k: motor[k] for k in keys})  # canonical field order
    stray = [p.relative_to(ROOT).as_posix() for p in MOTORS_DIR.rglob("*") if p.is_file() and p.suffix != ".json"]
    stray += [p.relative_to(ROOT).as_posix() for p in MOTORS_DIR.glob("*.json")]
    errors += [f"{s}: unexpected file (motors must be motors/<Manufacturer>/<Motor>.json)" for s in stray]
    return motors, errors


def render_database(motors):
    # Keep database.json byte-compatible with its historic formatting (ASCII-escaped).
    return json.dumps(motors, indent=4, ensure_ascii=True) + "\n"


def cmd_validate():
    motors, errors = collect()
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"{len(motors)} motors valid")
    return 0


def cmd_build():
    motors, errors = collect()
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    DATABASE.write_text(render_database(motors), encoding="utf-8")
    print(f"Wrote {len(motors)} motors to {DATABASE.name}")
    return 0


def cmd_check():
    motors, errors = collect()
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    current = DATABASE.read_text(encoding="utf-8") if DATABASE.exists() else ""
    if current != render_database(motors):
        print(f"{len(motors)} motors valid, but database.json is out of date. "
              "Run: python3 scripts/motordb.py build", file=sys.stderr)
        return 1
    print(f"{len(motors)} motors valid, database.json up to date")
    return 0


def cmd_split():
    schema, keys = load_schema()
    data = json.loads(DATABASE.read_text(encoding="utf-8"))
    errors = []
    for i, m in enumerate(data):
        errors += validate(m, keys, schema, f"database.json[{i}]")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    if MOTORS_DIR.exists():
        shutil.rmtree(MOTORS_DIR)
    used = set()
    for m in data:
        folder, base = manufacturer_dir(m), motor_filename(m)
        name, n = base, 2
        while (folder, name.lower()) in used:
            name, n = f"{base}-{n}", n + 1
        used.add((folder, name.lower()))
        path = MOTORS_DIR / folder / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dump({k: m[k] for k in keys}), encoding="utf-8")
    print(f"Wrote {len(data)} motor files to {MOTORS_DIR.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    commands = {"validate": cmd_validate, "build": cmd_build, "check": cmd_check, "split": cmd_split}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(commands[sys.argv[1]]())
