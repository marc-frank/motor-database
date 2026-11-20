#!/usr/bin/env python3
"""Tooling for the per-motor database layout.

Source of truth: motors/<Manufacturer>/<Motor>.json, one file per motor model.
A file lists every KV option of the model in "KV (RPM/V)"; values that differ
between KV options go in "Per-KV Values".

`build` generates, at deploy time (none of them are committed):
- database.json: what the website loads. One flat row per KV option, plus a "_file"
  field pointing back at the motor file it came from.
- database.csv: the same rows as CSV.
- motors.html: the same rows as a plain HTML table that works without JavaScript
  (for crawlers, AI agents and screen readers).

Usage:
    python3 scripts/motordb.py validate  # validate motors/ only
    python3 scripts/motordb.py build     # validate motors/ and write the files above

Standard library only.
"""
import csv
import html
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOTORS_DIR = ROOT / "motors"
DATABASE = ROOT / "database.json"
DATABASE_CSV = ROOT / "database.csv"
STATIC_TABLE = ROOT / "motors.html"
SCHEMA = ROOT / "motor.schema.json"

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
            motors.append((rel, motor))
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
    rows = [dict(row, _file=rel) for rel, m in motors for row in expand(m, columns)]
    DATABASE.write_text(json.dumps(rows, indent=4, ensure_ascii=True) + "\n", encoding="utf-8")
    DATABASE_CSV.write_text(to_csv(rows, columns), encoding="utf-8")
    STATIC_TABLE.write_text(to_html(rows, columns, len(motors)), encoding="utf-8")
    print(f"Wrote {len(rows)} rows ({len(motors)} motor files) to {DATABASE.name}, {DATABASE_CSV.name} and {STATIC_TABLE.name}")
    return 0


def to_csv(rows, columns):
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(columns)
    w.writerows([[r[c] for c in columns] for r in rows])
    return out.getvalue()


DATA_NOTE = (
    "Values are the manufacturers' published specifications, taken from product pages, spec sheets and product photos. "
    "They are not independent measurements. Empty means unknown."
)


def out_link(url):
    """Tag an outgoing product link so shops can see the visit came from this database.
    Appended as text so the shop's own query string is left exactly as it was."""
    if not re.match(r"https?://", url, re.I) or re.search(r"[?&]utm_source=", url):
        return url
    base, hash_, frag = url.partition("#")
    sep = "?" if "?" not in base else "" if base.endswith(("?", "&")) else "&"
    return base + sep + "utm_source=marc-frank.github.io/motor-database&utm_medium=referral" + hash_ + frag


def to_html(rows, columns, n_models):
    e = html.escape
    shown = [c for c in columns if c != "Image"]

    def cell(r, c):
        v = r[c]
        if c == "Link" and v:
            return f'<td><a href="{e(out_link(v))}">product page</a></td>'
        return f"<td>{e(v)}</td>"

    head = "".join(f"<th>{e(c)}</th>" for c in shown)
    body = "\n".join("<tr>" + "".join(cell(r, c) for c in shown) + "</tr>" for r in rows)
    n_mfr = len({r["Manufacturer"] for r in rows})
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>All motors – Motor Database</title>
<meta name="description" content="Specifications of {len(rows)} brushless motor KV versions ({n_models} models, {n_mfr} manufacturers) as one plain HTML table." />
<link rel="alternate" type="application/json" href="database.json" title="Motor database (JSON)" />
<link rel="alternate" type="text/csv" href="database.csv" title="Motor database (CSV)" />
<style>
body {{ font: 13px/1.4 system-ui, sans-serif; margin: 16px; }}
table {{ border-collapse: collapse; }}
th, td {{ border: 1px solid #ccc; padding: 3px 6px; white-space: nowrap; text-align: left; }}
th {{ background: #f0f0f0; position: sticky; top: 0; }}
</style>
</head>
<body>
<h1>Motor Database: all motors</h1>
<p>{len(rows)} rows, one per KV version, covering {n_models} motor models from {n_mfr} manufacturers.
This page is a static, JavaScript-free copy of the data. For searching, filtering and sorting use the
<a href="./">interactive table</a>.</p>
<p>Data: <a href="database.json">database.json</a> (all rows) ·
<a href="database.csv">database.csv</a> ·
<a href="motor.schema.json">motor.schema.json</a> (field definitions and units) ·
<a href="https://github.com/marc-frank/motor-database">source on GitHub</a></p>
<p>{e(DATA_NOTE)}</p>
<table>
<thead><tr>{head}</tr></thead>
<tbody>
{body}
</tbody>
</table>
</body>
</html>
"""


if __name__ == "__main__":
    commands = {"validate": cmd_validate, "build": cmd_build}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(commands[sys.argv[1]]())
