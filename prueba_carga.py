# -*- coding: utf-8 -*-
"""
Prueba de carga de la cola de El taller de retratos.

  python prueba_carga.py                      -> contra http://127.0.0.1:3220
  python prueba_carga.py https://...          -> contra otra dirección
  python prueba_carga.py URL --dejar          -> no vacía la cola al acabar (para ver el juego)

OJO: reinicia el estado del servidor al empezar. No la uses durante un directo.
"""
import json
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://127.0.0.1:3220').rstrip('/')
DEJAR = '--dejar' in sys.argv
YOS, REGALADORES, HILOS = 400, 120, 24
random.seed(7)


def post(path, obj):
    req = Request(BASE + path, data=json.dumps(obj).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def estado():
    with urlopen(BASE + '/events', timeout=30) as r:
        for line in r:
            if line.startswith(b'data: '):
                return json.loads(line[6:].decode('utf-8'))


def enviar(evento):
    t = time.time()
    try:
        post('/webhook', evento)
        return time.time() - t, None
    except Exception as exc:
        return time.time() - t, repr(exc)


def rafaga(nombre, eventos):
    t = time.time()
    with ThreadPoolExecutor(HILOS) as ex:
        res = list(ex.map(enviar, eventos))
    total = time.time() - t
    tiempos = sorted(r[0] for r in res)
    fallos = [r[1] for r in res if r[1]]
    print('  %-28s %4d envíos en %5.1f s (%4.0f/s) · mediana %3.0f ms · peor %4.0f ms · fallos %d' % (
        nombre, len(eventos), total, len(eventos) / total, tiempos[len(tiempos) // 2] * 1000, tiempos[-1] * 1000, len(fallos)))
    return fallos


fallos = []
print('Servidor:', BASE)
with urlopen(BASE + '/health', timeout=30) as r:
    abiertos = json.loads(r.read().decode('utf-8')).get('clients', 0)
if abiertos:
    print('AVISO: hay %d ventana(s) del juego o del panel abiertas. Si una es el juego, irá pintando gente\n'
          '       durante la prueba y el recuento de participantes saldrá corto.' % abiertos)
post('/api', {'action': 'reset_all'})

# 1) Muchos «yo» a la vez, mezclados con comentarios que no cuentan.
yos = [{'event': 'comment', 'username': 'yo%03d' % i, 'nickname': 'Yo %d' % i, 'imgprofile': '',
        'comment': random.choice(['yo', 'YO', 'yo!!', 'Yo porfa', 'yooo'])} for i in range(YOS)]
ruido = [{'event': 'comment', 'username': 'ruido%03d' % i, 'nickname': 'Ruido', 'comment':
          random.choice(['hola', 'jajaja', 'yo creo que es Francia seguro', 'de donde eres', '🔥🔥'])} for i in range(200)]
mezcla = yos + ruido + yos[:100]          # 100 repiten «yo»: no deben duplicarse
random.shuffle(mezcla)
fallos += rafaga('«yo» + ruido + repetidos', mezcla)

# 2) Regalos a la vez: unos ya estaban en la cola, otros entran con el regalo, varios regalan más de una vez.
esperado = {}
regalos = []
for i in range(REGALADORES):
    uid = 'yo%03d' % (i * 3) if i % 2 else 'rosa%03d' % i
    for _ in range(random.choice([1, 1, 1, 2, 3])):
        coins = random.choice([1, 1, 1, 1, 5, 5, 10, 30, 99, 500])
        esperado[uid] = esperado.get(uid, 0) + coins
        regalos.append({'event': 'gift', 'username': uid, 'nickname': uid, 'imgprofile': '', 'coins': str(coins)})
random.shuffle(regalos)
fallos += rafaga('regalos', regalos)

# 3) Empate: tres regalos iguales seguidos deben salir en orden de llegada.
for uid in ('empate_a', 'empate_b', 'empate_c'):
    post('/webhook', {'event': 'gift', 'username': uid, 'nickname': uid, 'coins': '7'})
    esperado[uid] = 7

s = estado()
nuevos = len([u for u in esperado if not u.startswith('yo')])
print('\nCola: %d personas (esperadas %d)' % (s['queueLen'], YOS + nuevos))

# 4) Vaciar la cola como lo hace el juego (next/done) y comprobar el orden completo.
t = time.time()
orden = []
while True:
    cur = post('/api', {'action': 'next'}).get('current')
    if not cur:
        break
    orden.append((cur['uid'], cur['coins']))
    post('/api', {'action': 'done', 'id': cur['id']})
print('Vaciada con next/done en %.1f s (%d cuadros, %d galerías)' % (time.time() - t, len(orden), len(orden) // 50))

monedas = [c for _, c in orden]
uids = [u for u, _ in orden]
checks = [
    ('Ningún envío falló', not fallos),
    ('Entraron todos y nadie duplicado', len(uids) == len(set(uids)) == YOS + nuevos),
    ('El ruido del chat no entró', not any(u.startswith('ruido') for u in uids)),
    ('Orden: nunca sale antes alguien con menos monedas', all(a >= b for a, b in zip(monedas, monedas[1:]))),
    ('Todos los que regalaron salen antes que los de solo «yo»', max(i for i, c in enumerate(monedas) if c) < min(i for i, c in enumerate(monedas) if not c)),
    ('Las monedas de cada uno suman lo regalado', all(c == esperado.get(u, 0) for u, c in orden)),
    ('Empate: sale primero quien regaló antes', [u for u in uids if u.startswith('empate')] == ['empate_a', 'empate_b', 'empate_c']),
]
print()
for nombre, ok in checks:
    print('  [%s] %s' % ('OK' if ok else 'FALLO', nombre))
print('\nPrimeros 8:', ', '.join('%s (%d)' % x for x in orden[:8]))
if fallos:
    print('Fallos:', fallos[:5])

if DEJAR:
    post('/api', {'action': 'reset_all'})
    post('/api', {'action': 'test', 'n': 20})
    for ev in yos[:300] + regalos:
        enviar(ev)
    print('\nCola dejada con %d personas para ver el juego.' % estado()['queueLen'])
else:
    post('/api', {'action': 'reset_all'})
    print('\nEstado del servidor reiniciado.')
sys.exit(0 if all(ok for _, ok in checks) else 1)
