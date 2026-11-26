# El taller de retratos

Videojuego 2D en pixel art pensado para emitir en **horizontal (16:9)** en TikTok LIVE. Un pintor recorre una galería de 50 cuadros y pinta la foto de perfil de cada participante.

## Abrir el juego

**En directo, con cola real:** doble clic en `iniciar.bat` (o `python server.py`). Arranca el servidor en el puerto 3220 y abre:

- el juego: `http://localhost:3220/`
- el panel de control: `http://localhost:3220/panel`

**Modo demo, sin servidor:** abre `demo.html` con doble clic. Usa participantes de muestra. También puedes forzarlo con `http://localhost:3220/?demo`.

### Conexión con TikTok (Interactive / TikFinity)

Misma arquitectura que Conquista Mundial: Interactive → `POST /webhook` → `server.py` → el juego (SSE).

En Interactive, el perfil **«pintar»** ya tiene dos acciones WebHook (`Taller chat` y `Taller regalo`) apuntando a `http://127.0.0.1:3220/webhook`, y dos eventos que las disparan: «Chat (global)» y «Gift (mínimo coins: 1)». Los cuerpos son:

```
{"event":"comment","username":"{username}","nickname":"{nickname}","imgprofile":"{imgprofile}","comment":"{comment}"}
{"event":"gift","username":"{username}","nickname":"{nickname}","imgprofile":"{imgprofile}","coins":"{coins}"}
```

`/debug` muestra las últimas peticiones recibidas. Con la variable de entorno `HOOK_TOKEN`, `/webhook` y `/api` exigen `?token=…`.

### Reglas de la cola

- Escribir **«yo»** (también «YO!!», «yo porfa», «yooo») mete en la cola. Gratis solo una vez por galería.
- **Cualquier regalo** mete en la cola o suma monedas a quien ya está. La cola se ordena por monedas y, a igualdad, por orden de llegada.
- Un regalo a quien **se está pintando ahora** mejora su marco en directo.
- Quien ya tiene cuadro puede volver a entrar con un regalo.
- Con la cola vacía, el pintor espera junto al lienzo y la llamada a escribir «yo» late.

El estado (cola, cuadro en curso y galería) se guarda en `state.json`, así que recargar el juego o reiniciar el servidor no pierde nada. Usa **una sola ventana del juego** a la vez: es el juego quien pide el siguiente participante.

Desde el panel puedes simular «yo» y regalos, añadir espectadores de prueba, quitar a alguien de la cola, **saltar el cuadro actual** (por ejemplo, una foto inapropiada), vaciar la cola y reiniciar todo.

### Editar

Si abres `index.html` con doble clic, el navegador no deja leer los píxeles del JPEG: las fotos salen sin el acabado de pintura y las gotas usan colores genéricos. Usa el servidor.

Después de editar, regenera la copia autónoma con `construir-demo.ps1` (clic derecho → Ejecutar con PowerShell).

### Controles

Los botones solo aparecen al pasar el ratón por encima o en pausa, para que no salgan en el directo.

- **Espacio**: pausar o continuar.
- **V**: cambiar la velocidad entre ×1, ×2 y ×4 (se recuerda).
- Si el navegador tiene activado el movimiento reducido, el juego arranca en pausa.

## Qué quiere el creador

- Quien escribe «yo» en el chat pide que el pintor pinte su foto de perfil.
- Una Rosa da prioridad. Cuanto mayor sea el valor acumulado de los regalos, antes llega el turno y más espectacular es el cuadro.
- Se esperan cientos de participantes. Cada galería tiene **50 cuadros**.
- El pintor camina hasta el lienzo, mueve el brazo y deja pintura bajo la punta del pincel. Al terminar, el cuadro queda expuesto y el pintor pasa al siguiente.

## Archivos

| Archivo | Contenido |
| --- | --- |
| `index.html` | Escenario 16:9: lienzo del juego y HUD (título, contador, participante, cola, cartel de galería, controles). |
| `estilos.css` | Aspecto del HUD. Las medidas usan `cqw` para escalar con el ancho del escenario. |
| `juego.js` | Todo el juego: sala, cuadros, pintor, luces, partículas, pinceladas y conexión con la cola. |
| `server.py` | Servidor sin dependencias: cola, webhook, SSE, proxy de avatares y estado en `state.json`. |
| `panel.html` | Panel de control y simulador (`/panel`). |
| `iniciar.bat` | Arranca el servidor y abre juego y panel. |
| `assets/retratos.jpg` | Cuatro fotos ficticias en una cuadrícula 2 × 2. |
| `demo.html` | Copia autónoma generada por `construir-demo.ps1`. No la edites a mano. |

## Cómo funciona

El mundo se dibuja en un Canvas de **480 × 270** píxeles que se amplía sin suavizado. Cada retrato mide 72 × 72 y los cuadros están separados 170 píxeles, así que se ven tres a la vez: el anterior, el actual y el siguiente.

`update(dt)` avanza estos estados:

1. **`walk`**: el pintor camina hasta el cuadro y el foco de ese cuadro se enciende.
2. **`paint`**: tres pasadas definidas en `PASSES`: **boceto** en sepia con pincel gordo, **color** en bloques y **detalles** con pincel fino. `pathPoint()` da la trayectoria y `stampAt()` copia la foto bajo la punta; esa misma coordenada mueve el brazo. Dura unos 8,4 segundos a ×1.
3. **`admire`**: destello, lluvia de chispas, el pintor se aparta y celebra.
4. **`fade`**: tras el cuadro 50 sale por la puerta, se funde a negro y empieza otra galería con otro color de pared (`THEMES`).

El orden de dibujo está en `draw()`: fondo prerenderizado (`buildTile`), luces, decoración, cuadros (`drawFrame`), pintor (`drawPainter`), partículas, plantas en primer plano y viñeta. El pintor se dibuja en un sprite aparte para añadirle el contorno y poder voltearlo.

### Efecto de las Rosas

`tierOf()` convierte las Rosas en un nivel que decide el marco y la celebración:

| Rosas | Nivel | Qué cambia |
| --- | --- | --- |
| 0 | Madera | Marco de nogal y chispas básicas. |
| 1–4 | Marco dorado | Marco dorado con perlado. |
| 5–19 | Marco de gala | Esquinas con gemas, brillos permanentes y lluvia de pétalos. |
| 20+ | Obra maestra | Corona, rayos de luz tras el cuadro y más chispas. |

Los umbrales son provisionales; se ajustarán al conectar los regalos reales.

## Cómo se conectan juego y servidor

Cada cuadro guarda una ficha `{id, coins, p}` en `assigned[i]`; `p` es la persona, con su foto ya convertida a los tres acabados (`makePic`). Las fotos reales se bajan por `/avatar?u=…`, que las pide con cabecera de TikTok para que el Canvas pueda leer sus píxeles; si no hay foto o falla, se pinta una silueta.

- `requestNext()` pide participante (`next`) y `done` avisa al terminar. `next` devuelve el mismo participante si había uno a medias, así una recarga repinta el cuadro en curso.
- `onState()` recibe cada cambio del servidor: actualiza la cola del HUD, sube las monedas del cuadro en curso, muestra los avisos y detecta saltos o reinicios hechos desde el panel.
- En modo demo, `actors` hace de cola.

## Qué falta

- **Desplegar en internet** si quieres usarlo como fuente de navegador en TikTok LIVE Studio (no acepta `localhost`). Mientras tanto se puede capturar la ventana del navegador.
- Ajustar los umbrales de los marcos con regalos reales.
- Quitar un cuadro ya terminado de la pared (hoy solo se puede saltar el que se está pintando).

## Comprobación rápida después de editar

Abre la versión editable y observa dos cuadros seguidos: la pintura debe aparecer bajo la punta, el primer retrato debe quedar en la pared y el segundo lienzo debe empezar en blanco. Para probar el cambio de galería sin esperar, escribe en la consola `tallerAvanzar(620)`, que adelanta 620 segundos de juego.
