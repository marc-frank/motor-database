#!/usr/bin/env python3
"""Tooling for the per-motor database layout.

Source of truth: motors/<Manufacturer>/<Motor>.json, one file per motor model.
A file lists every KV option of the model in "KV (RPM/V)"; values that differ
between KV options go in "Per-KV Values".

database.json is generated from those files at deploy time (it is not committed)
and is what the website loads. It has one flat row per KV option.

Usage:
    python3 scripts/motordb.py validate  # validate motors/ only
    python3 scripts/motordb.py build     # validate motors/ and write database.json
    python3 scripts/motordb.py split     # rewrite motors/ from a database.json (e.g. after an Excel round-trip)

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

KV = "KV (RPM/V)"
PER_KV = "Per-KV Values"
# Fields that identify the motor model and therefore can't vary per KV.
FIXED = {"Manufacturer", "Name", KV}
# Fields every database.json row needs (Link may come from "Per-KV Values").
NONEMPTY = ("Manufacturer", "Link")


def load_schema():
    """Return (schema, columns): columns are the flat fields of a database.json row, in order."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    columns = [k for k in schema["properties"] if k != PER_KV]
    return schema, columns


def slug(text):
    """Turn arbitrary text into a safe file/folder name."""
    text = unicodedata.normalize("NFKC", text).strip()
    text = re.sub(r"[^A-Za-z0-9.+_-]+", "_", text)
    return re.sub(r"_+", "_", text).strip("._-")


def kv_sort_key(kv):
    try:
        return (0, float(kv))
    except ValueError:
        return (1, kv)


def manufacturer_dir(motor):
    return slug(motor["Manufacturer"]) or "Unknown"


def motor_filename(motor):
    name = motor.get("Name", "")
    if not name:
        # Placeholder entries without a name: derive one from the product link.
        url = urlsplit(motor.get("Link", ""))
        name = re.sub(r"\.(html?|php|jsp|aspx?)$", "", url.path.rstrip("/").rsplit("/", 1)[-1])
        if name.lower() in GENERIC_PAGES:
            # e.g. index.php?product_id=1811 or pd.jsp?id=137: the id is the only identifier
            ids = [v for k, v in parse_qsl(url.query) if k.lower().endswith("id")]
            name = f"{name}-{ids[-1]}" if ids else name
    return slug(name)[:80].rstrip("._-") or "motor"


def dump(obj):
    return json.dumps(obj, indent=4, ensure_ascii=False) + "\n"


def nonempty_errors(row, where):
    return [f"{where}: field {k!r} must not be empty" for k in NONEMPTY if isinstance(row.get(k), str) and not row[k]]


def validate_motor(motor, schema, columns, where):
    """Validate one motor file (KV list + optional per-KV values)."""
    if not isinstance(motor, dict):
        return [f"{where}: expected a JSON object"]
    errors = []
    missing = [k for k in columns if k not in motor]
    extra = [k for k in motor if k not in schema["properties"]]
    if missing:
        errors.append(f"{where}: missing fields {missing}")
    if extra:
        errors.append(f"{where}: unknown fields {extra} (add them to motor.schema.json first)")
    for k in columns:
        if k != KV and k in motor and not isinstance(motor[k], str):
            errors.append(f"{where}: field {k!r} must be a string")

    kvs = motor.get(KV, [])
    if not isinstance(kvs, list) or not all(isinstance(v, str) and v for v in kvs):
        errors.append(f'{where}: {KV!r} must be a list of KV values, e.g. ["1950", "2800"] ([] if unknown)')
        kvs = []
    elif len(set(kvs)) != len(kvs):
        errors.append(f"{where}: {KV!r} lists the same KV more than once")

    per_kv = motor.get(PER_KV, {})
    if not isinstance(per_kv, dict):
        return errors + [f"{where}: {PER_KV!r} must be an object keyed by KV"]
    for kv, values in per_kv.items():
        w = f"{where}: {PER_KV}[{kv!r}]"
        if kv not in kvs:
            errors.append(f"{w}: {kv!r} is not listed in {KV!r}")
        if not isinstance(values, dict):
            errors.append(f"{w}: must be an object of field values")
            continue
        for field, value in values.items():
            if field in FIXED or field not in columns:
                errors.append(f"{w}: {field!r} can't be set per KV")
            elif not isinstance(value, str):
                errors.append(f"{w}: {field!r} must be a string")
            elif motor.get(field):
                errors.append(f"{w}: {field!r} is also set for all KVs; leave the shared value empty (\"\")")
    if not errors:
        for row in expand(motor, columns):
            errors += nonempty_errors(row, f"{where} (KV {row[KV]})" if row[KV] else where)
    return errors


def expand(motor, columns):
    """Turn one motor file into its database.json rows, one per KV."""
    rows = []
    for kv in motor[KV] or [""]:
        row = {c: motor[c] for c in columns}
        row[KV] = kv
        row.update(motor.get(PER_KV, {}).get(kv, {}))
        rows.append(row)
    return rows


def group(rows, columns):
    """Inverse of expand: merge rows of the same model (Manufacturer + Name) into motor files."""
    groups, open_groups = [], {}
    for row in rows:
        key = (row["Manufacturer"], row["Name"])
        g = open_groups.get(key)
        # Unnamed placeholders and rows without a KV are never merged.
        if not row["Name"] or not row[KV] or g is None or any(r[KV] == row[KV] for r in g):
            g = []
            groups.append(g)
            if row["Name"] and row[KV]:
                open_groups[key] = g
        g.append(row)

    motors = []
    for g in groups:
        g.sort(key=lambda r: kv_sort_key(r[KV]))
        motor, per_kv = {}, {}
        for c in columns:
            values = {r[c] for r in g}
            if c == KV:
                motor[c] = [r[KV] for r in g if r[KV]]
            elif len(values) == 1:
                motor[c] = g[0][c]
            else:
                motor[c] = ""
                for r in g:
                    if r[c]:
                        per_kv.setdefault(r[KV], {})[c] = r[c]
        if per_kv:
            motor[PER_KV] = {r[KV]: per_kv[r[KV]] for r in g if r[KV] in per_kv}
        motors.append(motor)
    return motors


def collect():
    """Read and validate motors/. Returns (motors, errors)."""
    schema, columns = load_schema()
    motors, errors = [], []
    for path in sorted(MOTORS_DIR.glob("*/*.json"), key=lambda p: (p.parent.name.lower(), p.name.lower())):
        rel = path.relative_to(ROOT).as_posix()
        try:
            motor = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{rel}: invalid JSON ({e})")
            continue
        errs = validate_motor(motor, schema, columns, rel)
        if not errs and manufacturer_dir(motor) != path.parent.name:
            errs.append(f"{rel}: Manufacturer {motor['Manufacturer']!r} belongs in motors/{manufacturer_dir(motor)}/")
        errors += errs
        if not errs:
            motors.append(motor)
    stray = [p.relative_to(ROOT).as_posix() for p in MOTORS_DIR.rglob("*") if p.is_file() and p.suffix != ".json"]
    stray += [p.relative_to(ROOT).as_posix() for p in MOTORS_DIR.glob("*.json")]
    errors += [f"{s}: unexpected file (motors must be motors/<Manufacturer>/<Motor>.json)" for s in stray]
    return motors, errors


def fail(errors):
    print("\n".join(errors), file=sys.stderr)
    return 1


def cmd_validate():
    motors, errors = collect()
    if errors:
        return fail(errors)
    print(f"{len(motors)} motor files valid")
    return 0


def cmd_build():
    motors, errors = collect()
    if errors:
        return fail(errors)
    _, columns = load_schema()
    rows = [row for m in motors for row in expand(m, columns)]
    DATABASE.write_text(json.dumps(rows, indent=4, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} rows ({len(motors)} motor files) to {DATABASE.name}")
    return 0


def cmd_split():
    schema, columns = load_schema()
    if not DATABASE.exists():
        return fail(["database.json not found. Download it from the website or run `build` first."])
    rows = json.loads(DATABASE.read_text(encoding="utf-8"))
    errors = []
    for i, row in enumerate(rows):
        where = f"database.json[{i}]"
        if not isinstance(row, dict):
            errors.append(f"{where}: expected a JSON object")
            continue
        missing = [k for k in columns if k not in row]
        extra = [k for k in row if k not in columns]
        if missing:
            errors.append(f"{where}: missing fields {missing}")
        if extra:
            errors.append(f"{where}: unknown fields {extra} (add them to motor.schema.json first)")
        errors += [f"{where}: field {k!r} must be a string" for k, v in row.items() if not isinstance(v, str)]
        errors += nonempty_errors(row, where)
    if errors:
        return fail(errors)

    motors = group(rows, columns)
    if MOTORS_DIR.exists():
        shutil.rmtree(MOTORS_DIR)
    used = set()
    for m in motors:
        folder, base = manufacturer_dir(m), motor_filename(m)
        name, n = base, 2
        while (folder, name.lower()) in used:
            name, n = f"{base}-{n}", n + 1
        used.add((folder, name.lower()))
        path = MOTORS_DIR / folder / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dump(m), encoding="utf-8")
    print(f"Wrote {len(rows)} rows as {len(motors)} motor files to {MOTORS_DIR.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    commands = {"validate": cmd_validate, "build": cmd_build, "split": cmd_split}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(commands[sys.argv[1]]())
