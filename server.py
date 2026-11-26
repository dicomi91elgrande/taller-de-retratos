# -*- coding: utf-8 -*-
"""
EL TALLER DE RETRATOS - cola real para TikTok LIVE.

  Interactive/TikFinity (chat/regalo) --POST--> /webhook --SSE--> juego + panel

- Juego (fuente de navegador):     /          (16:9)
- Panel de control (solo para ti): /panel
- WebHook de Interactive:          /webhook   (POST JSON)

Reglas:
- Quien escribe «yo» entra en la cola (una vez gratis por galería).
- Cualquier regalo mete en la cola o suma monedas a quien ya está: la cola se ordena por
  monedas (más monedas = antes) y, a igualdad, por orden de llegada.
- Si regalan a quien se está pintando ahora, su marco mejora en directo.
- El juego pide el siguiente participante («next») y avisa al terminar («done»).

Sin dependencias: solo librería estándar.   python server.py
"""
import json
import os
import queue
import random
import re
import threading
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
from urllib.request import Request, urlopen

PORT = int(os.environ.get('PORT', 3220))
HOOK_TOKEN = os.environ.get('HOOK_TOKEN')      # opcional: protege /webhook y /api con ?token=
BASE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE, 'state.json')

BOOT = str(int(time.time()))   # cambia en cada arranque: el juego y el panel se recargan solos al verlo
TOTAL = 50               # cuadros por galería
MAX_QUEUE = 800

FILES = {
    '/': ('index.html', 'text/html; charset=utf-8'),
    '/index.html': ('index.html', 'text/html; charset=utf-8'),
    '/panel': ('panel.html', 'text/html; charset=utf-8'),
    '/cola': ('cola.html', 'text/html; charset=utf-8'),
    '/estilos.css': ('estilos.css', 'text/css; charset=utf-8'),
    '/juego.js': ('juego.js', 'text/javascript; charset=utf-8'),
    '/assets/retratos.jpg': ('assets/retratos.jpg', 'image/jpeg'),
}

lock = threading.RLock()
clients = []
clients_lock = threading.Lock()


def ms():
    return int(time.time() * 1000)


def log(*a):
    print(*a, flush=True)


def default_state():
    return {
        'v': 0, 'seq': 0, 'room': 1,
        'users': {},        # uid -> {name, img}
        'queue': [],        # [{uid, coins, n}]  ordenada: más monedas primero, luego llegada
        'current': None,    # {id, uid, coins}   quien se está pintando
        'gallery': [],      # [{id, uid, coins}] cuadros terminados de la galería actual
        'events': [],       # últimos avisos para el juego y el panel
    }


state = default_state()


def load_state():
    global state
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        merged = default_state()
        merged.update(data)
        state = merged
        log(' Estado cargado: galería %d, %d cuadros, %d en cola' % (state['room'], len(state['gallery']), len(state['queue'])))
    except FileNotFoundError:
        pass
    except Exception as exc:
        log(' No se pudo leer state.json:', exc)


def save_state():
    try:
        tmp = STATE_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False)
        os.replace(tmp, STATE_FILE)
    except Exception as exc:
        log(' No se pudo guardar state.json:', exc)


# ---------------------------------------------------------------- difusión
def view():
    q = state['queue'][:60]
    uids = {e['uid'] for e in q} | {g['uid'] for g in state['gallery']} | {e.get('uid') for e in state['events']}
    if state['current']:
        uids.add(state['current']['uid'])
    return {
        'v': state['v'], 'boot': BOOT, 'room': state['room'], 'total': TOTAL,
        'gallery': state['gallery'], 'current': state['current'],
        'queue': q, 'queueLen': len(state['queue']),
        'users': {u: state['users'].get(u, {'name': u}) for u in uids if u},
        'events': state['events'][-12:],
    }


def broadcast():
    data = json.dumps(view(), ensure_ascii=False)
    with clients_lock:
        for q in list(clients):
            q.put(data)


pending = {'send': False, 'save': False}
SEND_EVERY = 0.15        # como mucho un aviso a juego y panel cada 150 ms
SAVE_EVERY = 2.0         # y una escritura de state.json cada 2 s


def changed():
    """Llamar (con el lock cogido) tras cualquier cambio de estado.

    No escribe ni difunde al momento: con cientos de mensajes por minuto, hacerlo en cada uno
    ahogaba el servidor. Lo hace `flusher`, agrupando los cambios.
    """
    state['v'] += 1
    pending['send'] = pending['save'] = True


def flusher():
    last_save = 0
    while True:
        time.sleep(SEND_EVERY)
        with lock:
            if pending['send']:
                pending['send'] = False
                broadcast()
            if pending['save'] and time.time() - last_save >= SAVE_EVERY:
                pending['save'] = False
                last_save = time.time()
                save_state()


def ev(kind, **kw):
    state['seq'] += 1
    e = {'id': state['seq'], 't': ms(), 'kind': kind}
    e.update(kw)
    state['events'].append(e)
    del state['events'][:-30]
    return e


# ---------------------------------------------------------------- usuarios
def slug(text):
    s = unicodedata.normalize('NFD', str(text or '').lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))


def norm_uid(username, nickname=''):
    u = re.sub(r'\s+', '', str(username or '').strip().lstrip('@').lower())
    if not u or '{' in u:
        u = slug(nickname)
    return u[:40] or 'anon'


def touch_user(uid, name=None, img=None):
    u = state['users'].setdefault(uid, {'name': uid})
    name = str(name or '').strip()
    if name and '{' not in name:
        u['name'] = name[:40]
    img = str(img or '').strip()
    if img.lower().startswith(('http%3a', 'https%3a')):
        img = unquote(img)
    if (img.startswith('http') or re.fullmatch(r'demo:\d', img)) and '{' not in img:
        u['img'] = img
    return u


def uid_from_name(name):
    """Para el panel: reutiliza un usuario existente si el nombre coincide."""
    name = str(name or '').strip()
    low = name.lstrip('@').lower()
    for uid, u in state['users'].items():
        if uid == low or u.get('name', '').lower() == name.lower():
            return uid
    return norm_uid(name, name)


# ---------------------------------------------------------------- cola
def sort_queue():
    state['queue'].sort(key=lambda e: (-e['coins'], e['n']))


def position(uid):
    for i, e in enumerate(state['queue']):
        if e['uid'] == uid:
            return i + 1
    return 0


def wants_in(text):
    """«yo», «YO!!», «yo porfa», «yooo»… pero no una frase larga que empiece por «yo»."""
    words = re.findall(r'[^\W\d_]+', str(text or '').lower())
    return bool(words) and len(str(text)) <= 24 and re.fullmatch(r'yo+', slug(words[0])) is not None


def join(uid, name, img):
    cur = state['current']
    if cur and cur['uid'] == uid:
        return 'se está pintando'
    if position(uid):
        return 'ya en cola'
    if any(g['uid'] == uid for g in state['gallery']):
        return 'ya pintado en esta galería'
    if len(state['queue']) >= MAX_QUEUE:
        return 'cola llena'
    touch_user(uid, name, img)
    state['seq'] += 1
    state['queue'].append({'uid': uid, 'coins': 0, 'n': state['seq']})
    sort_queue()
    ev('join', uid=uid, pos=position(uid))
    changed()
    return 'ok'


# Catálogo de regalos de TikTok: ID -> nombre, monedas e icono (lo genera actualizar_regalos.py).
GIFTS, GIFT_IDS, GIFT_NAMES = [], {}, {}


def load_gifts():
    try:
        with open(os.path.join(BASE, 'regalos.json'), 'r', encoding='utf-8') as f:
            data = json.load(f)
        GIFTS[:] = data['g']
        GIFT_IDS.update(data['ids'])
        for i, g in enumerate(GIFTS):
            GIFT_NAMES.setdefault(slug(g[0]), i)
        log(' Catálogo de regalos: %d' % len(GIFTS))
    except Exception as exc:
        log(' Sin catálogo de regalos (regalos.json):', exc)


def find_gift(gid, gname):
    """Devuelve {name, img, unit} del regalo, por ID o por nombre; None si no se sabe cuál es."""
    gid, gname = str(gid or '').strip(), str(gname or '').strip()
    i = GIFT_IDS.get(gid)
    if i is None and gname and '{' not in gname:
        i = GIFT_NAMES.get(slug(gname))
    if i is not None:
        return {'name': GIFTS[i][0], 'img': GIFTS[i][2], 'unit': GIFTS[i][1]}
    if gname and '{' not in gname:
        return {'name': gname[:30], 'img': '', 'unit': 0}
    return None


def note_gift(entry, gift, coins, n):
    """Apunta en la ficha qué regalo envió y cuántos; el más valioso queda primero."""
    name = gift['name'] if gift else 'Regalo'
    gifts = entry.setdefault('gifts', [])
    for g in gifts:
        if g['name'] == name:
            g['n'] += n
            break
    else:
        gifts.append({'name': name, 'img': gift['img'] if gift else '',
                      'unit': (gift and gift['unit']) or max(1, coins // max(n, 1)), 'n': n})
    gifts.sort(key=lambda g: -g['unit'])


def add_gift(uid, name, img, coins, gift=None, n=1):
    """`coins` es el total del envío (n regalos iguales)."""
    coins = max(0, int(coins))
    if coins <= 0:
        return 'sin monedas'
    touch_user(uid, name, img)
    info = {'gift': gift['name'] if gift else 'Regalo', 'img': gift['img'] if gift else '', 'n': n}
    cur = state['current']
    if cur and cur['uid'] == uid:
        cur['coins'] += coins
        note_gift(cur, gift, coins, n)
        ev('gift', uid=uid, coins=coins, total=cur['coins'], pos=0, **info)
        changed()
        return 'mejora su cuadro'
    entry = next((e for e in state['queue'] if e['uid'] == uid), None)
    if entry:
        entry['coins'] += coins
    else:
        state['seq'] += 1
        entry = {'uid': uid, 'coins': coins, 'n': state['seq']}
        state['queue'].append(entry)
    note_gift(entry, gift, coins, n)
    sort_queue()
    ev('gift', uid=uid, coins=coins, total=entry['coins'], pos=position(uid), **info)
    changed()
    return 'cola nº %d' % position(uid)


def take_next():
    """El juego pide participante. Si ya hay uno a medias (recarga), devuelve ese."""
    if not state['current'] and state['queue']:
        e = state['queue'].pop(0)
        state['seq'] += 1
        state['current'] = {'id': state['seq'], 'uid': e['uid'], 'coins': e['coins'], 'gifts': e.get('gifts', [])}
        changed()
    return state['current']


def finish(pid):
    cur = state['current']
    if not cur or cur['id'] != pid:
        return
    state['gallery'].append(cur)
    state['current'] = None
    if len(state['gallery']) >= TOTAL:        # galería completa: empieza la siguiente
        state['room'] += 1
        state['gallery'] = []
        keep = {e['uid'] for e in state['queue']}
        state['users'] = {u: d for u, d in state['users'].items() if u in keep}
    changed()


# ---------------------------------------------------------------- acciones (juego y panel)
TEST_NAMES = ['Miso', 'Vera Art', 'Bruno', 'Lucía', 'Dani RM', 'Nora', 'Keko99', 'Sofi', 'Tomi', 'Aitana',
              'Leo', 'Marta', 'Hugo', 'Carla', 'Pau', 'Irene', 'Nico', 'Alba', 'Izan', 'Noa']


def api_action(a, d):
    """Devuelve (error o None, datos extra para la respuesta)."""
    global state
    if a == 'next':
        cur = take_next()
        return None, {'current': cur, 'user': state['users'].get(cur['uid']) if cur else None}
    if a == 'done':
        finish(d.get('id'))
    elif a == 'gift':
        name = str(d.get('name') or '').strip()
        if not name:
            return 'Falta el nombre', {}
        uid = uid_from_name(name)
        gift = find_gift(d.get('giftid'), d.get('giftname'))
        n = min(999, max(1, int(d.get('n') or 1)))
        unit = (gift and gift['unit']) or int(d.get('coins') or 0)
        add_gift(uid, name if uid not in state['users'] else None, d.get('img'), unit * n, gift, n)
    elif a == 'comment':
        name = str(d.get('name') or '').strip()
        if not name:
            return 'Falta el nombre', {}
        if not wants_in(d.get('text') or 'yo'):
            return 'Ese comentario no cuenta como «yo»', {}
        uid = uid_from_name(name)
        res = join(uid, name if uid not in state['users'] else None, d.get('img'))
        if res != 'ok':
            return 'No entra: ' + res, {}
    elif a == 'test':
        for _ in range(min(20, max(1, int(d.get('n') or 5)))):
            name = random.choice(TEST_NAMES) + str(random.randint(1, 99))
            uid = norm_uid(name)
            img = 'demo:%d' % random.randint(0, 3)
            if random.random() < 0.4:
                gift = find_gift(None, random.choice(['Rose', 'Rose', 'Rose', 'Finger Heart', 'Doughnut', 'Corgi']))
                n = random.choice([1, 1, 2, 3, 5])
                add_gift(uid, name, img, ((gift and gift['unit']) or 1) * n, gift, n)
            else:
                join(uid, name, img)
    elif a == 'remove':
        state['queue'] = [e for e in state['queue'] if e['uid'] != d.get('uid')]
        changed()
    elif a == 'skip_current':
        if not state['current']:
            return 'No se está pintando a nadie', {}
        ev('info', text='Cuadro saltado desde el panel')
        state['current'] = None
        changed()
    elif a == 'clear_queue':
        state['queue'] = []
        changed()
    elif a == 'reset_all':
        seq = state['seq']
        state = default_state()
        state['seq'] = seq
        ev('info', text='Todo reiniciado')
        changed()
    else:
        return 'Acción desconocida', {}
    return None, {}


def handle_webhook(obj):
    """Evento de Interactive/TikFinity. Devuelve una etiqueta para el log."""
    uid = norm_uid(obj.get('username') or obj.get('user'), obj.get('nickname') or '')
    name = obj.get('nickname') or obj.get('nick') or obj.get('username') or ''
    img = obj.get('imgprofile') or obj.get('img') or obj.get('avatar') or obj.get('profilePictureUrl') or ''
    event = str(obj.get('event') or '').lower()
    comment = obj.get('comment') or obj.get('message') or obj.get('text')
    if event == 'comment' or (comment is not None and 'coins' not in obj):
        if not wants_in(comment):
            return 'comment:ignorado'
        return 'comment:' + join(uid, name, img)
    if event in ('gift', 'coins') or 'coins' in obj:
        gift = find_gift(obj.get('giftid'), obj.get('giftname'))
        try:
            coins = int(float(str(obj.get('coins'))))
        except (TypeError, ValueError):        # el botón de prueba de Interactive deja {coins} vacío
            coins = (gift and gift['unit']) or 1
        try:                                   # si el webhook se manda una sola vez por combo, trae {repeatcount}
            repeat = int(float(str(obj.get('repeat'))))
        except (TypeError, ValueError):
            repeat = 1
        repeat = min(max(repeat, 1), 1000)
        coins *= repeat
        return 'gift:%d -> %s' % (coins, add_gift(uid, name, img, coins, gift, repeat))
    return 'ignorado'


recent = []              # últimas peticiones recibidas en /webhook (diagnóstico en /debug)
bad_bodies = []          # últimos cuerpos que no se pudieron leer (diagnóstico en /debug)


def parse_body(text, depth=0):
    """JSON normal; tolera placeholders sin comillas ("coins":{coins}) y el cuerpo enviado como cadena JSON."""
    try:
        obj = json.loads(text)
    except ValueError:
        fixed = re.sub(r':\s*\{(\w+)\}', lambda m: ': "{' + m.group(1) + '}"', text)
        fixed = re.sub(r':\s*(?=[,}])', ': null', fixed)      # placeholder vacío: "coins":}
        obj = json.loads(fixed)
    if isinstance(obj, str) and depth < 2:      # Interactive a veces manda el JSON dentro de una cadena
        return parse_body(obj, depth + 1)
    return obj


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path in FILES:
            self.serve_file(*FILES[path])
        elif path == '/events':
            self.handle_sse()
        elif path == '/webhook':
            self.do_POST()
        elif path == '/health':
            self.send_json({'ok': True, 'clients': len(clients)})
        elif path == '/debug':
            self.send_json({'recent': recent, 'bad_bodies': bad_bodies, 'v': state['v']})
        elif path == '/avatar':
            self.serve_avatar()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404')

    def serve_file(self, rel, ctype):
        with open(os.path.join(BASE, rel), 'rb') as f:
            body = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_avatar(self):
        """Descarga la foto de perfil con Referer de TikTok para que el juego pueda leer sus píxeles."""
        url = (parse_qs(urlparse(self.path).query).get('u', [''])[0] or '').strip()
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            self.send_response(400)
            self.end_headers()
            return
        try:
            req = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*,*/*;q=0.8',
                                        'Referer': 'https://www.tiktok.com/'})
            with urlopen(req, timeout=8) as resp:
                body = resp.read(3 * 1024 * 1024 + 1)
                if len(body) > 3 * 1024 * 1024:
                    raise ValueError('avatar demasiado grande')
                ctype = resp.headers.get('Content-Type', 'image/jpeg').split(';', 1)[0]
                if not ctype.startswith('image/'):
                    ctype = 'image/jpeg'
        except Exception:
            self.send_response(502)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'public, max-age=86400')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_sse(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self._cors()
        self.end_headers()
        q = queue.Queue()
        with lock:
            first = json.dumps(view(), ensure_ascii=False)
        with clients_lock:
            clients.append(q)
        try:
            self.wfile.write(('data: ' + first + '\n\n').encode('utf-8'))
            self.wfile.flush()
            while True:
                try:
                    data = q.get(timeout=15)
                    self.wfile.write(('data: ' + data + '\n\n').encode('utf-8'))
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with clients_lock:
                if q in clients:
                    clients.remove(q)

    def read_body(self):
        if 'chunked' in (self.headers.get('Transfer-Encoding') or '').lower():
            data = b''
            while True:
                size = int((self.rfile.readline().split(b';')[0].strip() or b'0'), 16)
                if size == 0:
                    self.rfile.readline()
                    break
                data += self.rfile.read(size)
                self.rfile.readline()
            return data
        length = int(self.headers.get('Content-Length', '0') or 0)
        return self.rfile.read(length) if length else b''

    def do_PUT(self):
        self.do_POST()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path not in ('/webhook', '/api'):
            self.send_response(404)
            self.end_headers()
            return
        if HOOK_TOKEN and parse_qs(parsed.query).get('token', [''])[0] != HOOK_TOKEN:
            self.send_json({'ok': False, 'error': 'token'}, 403)
            return
        raw = self.read_body()
        if parsed.path == '/webhook':
            recent.append({'t': ms(), 'method': self.command, 'query': parsed.query[:200],
                           'ctype': self.headers.get('Content-Type'), 'len': len(raw),
                           'te': self.headers.get('Transfer-Encoding'), 'raw': raw[:700].decode('latin-1')})
            del recent[:-10]
        try:
            try:
                text = raw.decode('utf-8')
            except UnicodeDecodeError:
                text = raw.decode('latin-1')
            obj = parse_body(text) if raw else {}
        except Exception:
            obj = {}
            bad_bodies.append({'t': ms(), 'path': parsed.path, 'raw': raw[:400].decode('latin-1')})
            del bad_bodies[:-10]
        if not isinstance(obj, dict):
            obj = {}
        if not obj and parsed.path == '/webhook':
            form = parse_qs(parsed.query)
            try:
                form.update(parse_qs(raw.decode('utf-8', 'replace')))
            except Exception:
                pass
            obj = {k: v[0] for k, v in form.items() if k != 'token'}
        try:
            with lock:
                if parsed.path == '/webhook':
                    res = handle_webhook(obj)
                    if res != 'comment:ignorado':
                        log('webhook:', obj.get('username'), res)
                    self.send_json({'ok': True, 'result': res})
                else:
                    err, extra = api_action(str(obj.get('action') or ''), obj)
                    out = {'ok': not err, 'error': err, 'v': state['v']}
                    out.update(extra)
                    self.send_json(out)
        except Exception as exc:
            log('error:', repr(exc))
            self.send_json({'ok': False, 'error': repr(exc)}, 500)


if __name__ == '__main__':
    load_state()
    load_gifts()
    threading.Thread(target=flusher, daemon=True).start()
    log('=' * 60)
    log(' EL TALLER DE RETRATOS')
    log(f' Juego   : http://localhost:{PORT}/')
    log(f' Panel   : http://localhost:{PORT}/panel')
    log(f' WebHook : http://localhost:{PORT}/webhook')
    log('=' * 60)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
