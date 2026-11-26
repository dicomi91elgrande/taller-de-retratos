# -*- coding: utf-8 -*-
"""
Genera regalos.json (ID de regalo de TikTok -> nombre, monedas e icono) a partir del catálogo
que Interactive guarda en este PC. Ejecútalo cuando TikTok añada regalos nuevos:

    python actualizar_regalos.py

Interactive solo manda {giftid} y {giftname} en el webhook; el icono sale de este archivo.
"""
import glob
import json
import os

SRC = os.path.join(os.environ['APPDATA'], 'Interactive')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'regalos.json')

files = [os.path.join(SRC, 'available_gift.json'), os.path.join(SRC, 'Gifts', 'gifts-global-full.json')]
files += sorted(glob.glob(os.path.join(SRC, 'Gifts', 'gifts-region-*.json')))

gifts, index, ids = [], {}, {}
for path in files:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError):
        continue
    for g in data if isinstance(data, list) else []:
        name, img, coins = g.get('name'), g.get('image_url'), g.get('diamond_count')
        if not name or not img:
            continue
        key = (name, coins)                    # el mismo regalo trae una URL distinta por región: basta una
        for gid in (g.get('ids') or []) + [g.get('id')]:
            if gid is None or str(gid) in ids:
                continue
            if key not in index:
                index[key] = len(gifts)
                gifts.append([name, coins or 0, img])
            ids[str(gid)] = index[key]

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({'g': gifts, 'ids': ids}, f, ensure_ascii=False, separators=(',', ':'))
print('regalos.json: %d regalos, %d IDs, %d KB' % (len(gifts), len(ids), os.path.getsize(OUT) // 1024))
for n in ('Rose', 'Finger Heart', 'Doughnut', 'Corgi', 'Galaxy'):
    print('  %-13s' % n, next(([g[1], [i for i, k in ids.items() if gifts[k] is g][:2]] for g in gifts if g[0] == n), 'NO ESTÁ'))
