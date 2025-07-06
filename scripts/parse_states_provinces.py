#!/usr/bin/env python3
"""parse_states_provinces.py — Convert raw enumeration text into a bulk INSERT.

Usage:
    1. Put the enumeration text (everything starting with "Enumeration for Country Code ..."
       through the end) into a file named 'enumerations.txt' in the same directory.
    2. Run:  python parse_states_provinces.py
    3. The script writes 'states_provinces_import.sql'.

Columns:
    dxcc_entity – numeric DXCC country code (taken from each section header)
    code        – subdivision code
    name        – subdivision name
    type        – (always NULL, adjust parsing if you have a field)
    created_at  – NOW()
    cq_zone     – last numeric-ish column found in the row (if any)
    itu_zone    – second‑to‑last numeric-ish column found in the row (if any)
"""

import re
from pathlib import Path

INPUT_FILE = 'enumerations.txt'
OUTPUT_FILE = 'states_provinces_import.sql'

def clean_zone(token: str) -> str | None:
    token = token.strip()
    # Remove obvious prefixes like S=16 or T=17
    token = re.sub(r'[A-Za-z=]', '', token)
    token = token.strip()
    return token if token else None

def parse_lines(lines):
    current_entity = None
    for raw in lines:
        line = raw.rstrip('\n')
        if not line.strip():
            continue

        # Detect a new country section
        m = re.match(r'Enumeration\s+for\s+Country\s+Code\s+(\d+)', line, re.I)
        if m:
            current_entity = int(m.group(1))
            continue

        if line.lstrip().startswith('Code'):
            # Header row
            continue
        if current_entity is None:
            # Skip until we know the entity
            continue

        # Split row on either TABs or runs of 2+ spaces
        parts = [p.strip() for p in (line.split('\t') if '\t' in line else re.split(r'\s{2,}', line)) if p.strip()]
        if len(parts) < 2:
            continue

        code, name = parts[0], parts[1]
        cq_zone = itu_zone = None

        # Scan remaining parts from right to left for numeric tokens (zones)
        for token in reversed(parts[2:]):
            if cq_zone is None and re.search(r'\d', token):
                cq_zone = clean_zone(token)
                continue
            if itu_zone is None and re.search(r'\d', token):
                itu_zone = clean_zone(token)
                continue

        yield (current_entity, code, name, cq_zone, itu_zone)

def main():
    enum_path = Path(INPUT_FILE)
    if not enum_path.exists():
        print(f'Error: {INPUT_FILE} not found. Make sure it is in the same directory.')
        return

    rows = list(parse_lines(enum_path.open(encoding='utf-8')))
    if not rows:
        print('No rows parsed – check that the enumeration text is correct.')
        return

    out_path = Path(OUTPUT_FILE)
    with out_path.open('w', encoding='utf-8') as f:
        f.write('INSERT INTO states_provinces (dxcc_entity, code, name, type, created_at, cq_zone, itu_zone)\nVALUES\n')
        values = []
        for dxcc, code, name, cq, itu in rows:
            name_sql = name.replace("'", "''")
            cq_sql = f"'{cq}'" if cq else 'NULL'
            itu_sql = f"'{itu}'" if itu else 'NULL'
            values.append(f"  ({dxcc}, '{code}', '{name_sql}', NULL, NOW(), {cq_sql}, {itu_sql})")
        f.write(',\n'.join(values))
        f.write(';\n')

    print(f'Wrote {len(rows)} rows to {OUTPUT_FILE}')

if __name__ == '__main__':
    main()

