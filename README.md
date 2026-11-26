# El taller de retratos

Videojuego 2D en pixel art pensado para emitir en **horizontal (16:9)** en TikTok LIVE. Un pintor recorre una galería de 50 cuadros y pinta la foto de perfil de cada participante.

## Abrir el juego

**En directo, con cola real:** doble clic en `iniciar.bat` (o `python server.py`). Arranca el servidor en el puerto 3220 y abre:

- el juego: `http://localhost:3220/`
- el panel de control: `http://localhost:3220/panel`

**Modo demo, sin servidor:** abre `demo.html` con doble clic. Usa participantes de muestra. También puedes forzarlo con `http://localhost:3220/?demo`.

### En internet (Render)

Desplegado en **https://taller-de-retratos.onrender.com** (panel en `/panel`, webhook en `/webhook`, diagnóstico en `/debug`). Repositorio `dicomi91elgrande/taller-de-retratos`, rama `main`, con despliegue automático en cada `git push`. El plan gratuito duerme tras 15 minutos sin uso y tarda cerca de un minuto en despertar; cada redespliegue o reinicio borra la cola y la galería, así que no subas cambios durante un directo.

### Conexión con TikTok (Interactive / TikFinity)

Misma arquitectura que Conquista Mundial: Interactive → `POST /webhook` → `server.py` → el juego (SSE).

En Interactive, el perfil **«pintar»** ya tiene dos acciones WebHook (`Taller chat` y `Taller regalo`) apuntando a `https://taller-de-retratos.onrender.com/webhook`, y dos eventos que las disparan: «Chat (global)» y «Gift (mínimo coins: 1)». Los cuerpos son:

```
{"event":"comment","username":"{username}","nickname":"{nickname}","imgprofile":"{imgprofile}","comment":"{comment}"}
{"event":"gift","username":"{username}","nickname":"{nickname}","imgprofile":"{imgprofile}","coins":"{coins}","giftid":"{giftid}","giftname":"{giftname}"}
```

Interactive no manda la imagen del regalo, solo su ID y su nombre. El icono sale de `regalos.json`, que `actualizar_regalos.py` genera a partir del catálogo que Interactive guarda en este PC; vuelve a ejecutarlo cuando TikTok añada regalos nuevos. Un regalo desconocido se muestra con 🎁.

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
- **M**: activar o quitar la música (se recuerda). La música se genera con WebAudio, sin archivos: un vals tranquilo en la galería y una versión más viva durante el súper cuadro. `?musica=0` en la dirección la desactiva y `?vol=30` fija el volumen (0–100; por defecto 45). En un navegador normal no suena hasta la primera pulsación.
- Si el navegador tiene activado el movimiento reducido, el juego arranca en pausa.

## Widgets para TikTok LIVE Studio

Son páginas aparte, con fondo transparente, que se añaden como fuente de enlace y se ponen al tamaño que quieras. Añade `?fondo=1` para verlas con fondo oscuro en un navegador.

| Dirección | Qué muestra | Tamaño recomendado |
| --- | --- | --- |
| `/cola` | Quién se está pintando y los 8 siguientes, con foto, nombre e icono y cantidad de cada regalo. `?n=12` cambia cuántos se ven. | 420 × 600 |
| `/batalla` | Widget «SUPER CUADRO»: dos tarjetas con el top 1 y el top 2 de donadores, reloj y el 3º. | 600 × 280 |

## Batalla de donadores y cuadro gigante

- Durante la batalla (3 minutos por defecto), cada regalo suma para la batalla además de para la cola.
- Al llegar el reloj a cero la batalla se congela y espera. No pasa nada hasta que pulses el botón.
- **El botón** cierra la batalla y empieza la siguiente. Si alguien regaló, el 1º se lleva el cuadro gigante; en empate gana quien llegó antes a esa cifra; si nadie regaló, solo se reinicia.
- El botón está en el panel y en la dirección `/do/batalla` (para un atajo o Stream Deck). `/do/parar` detiene las batallas.
- **Cuadro gigante**: en ese momento la galería se congela tal cual, el pintor sube en una góndola por la fachada del rascacielos y pinta la foto del ganador en una lona gigante, con focos y fuegos artificiales. Esta escena se dibuja en un lienzo aparte de 1920 × 1080 (`.hd`) y la foto se pinta a 672 × 672 a partir de la imagen original, sin el acabado pixelado de la galería. Dura unos 25 segundos y después la galería sigue donde estaba. El ganador conserva su turno normal en la cola.
- En modo demo, la tecla **B** lanza un cuadro gigante de prueba.

En el código: `battle_button()` y `battle_add()` en `server.py`; `startMural()`, `updateMural()` y `drawMural()` en `juego.js`.

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

El mundo se dibuja en un Canvas de **480 × 270** píxeles que se amplía sin suavizado. Encima hay otras dos capas: `.fotos` (1920 × 1080), donde solo se pintan las fotos de los cuadros a 288 × 288, y `.frente` (480 × 270), con el pintor, las partículas y las plantas que pasan por delante. Dibujar toda la galería a 1080p costaba unos 18 ms por fotograma; con las capas, menos de 3. En unidades del mundo, cada retrato mide 72 × 72 y los cuadros están separados 170 píxeles, así que se ven tres a la vez: el anterior, el actual y el siguiente.

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

- Ajustar los umbrales de los marcos con regalos reales.
- Quitar un cuadro ya terminado de la pared (hoy solo se puede saltar el que se está pintando).

## Comprobación rápida después de editar

Abre la versión editable y observa dos cuadros seguidos: la pintura debe aparecer bajo la punta, el primer retrato debe quedar en la pared y el segundo lienzo debe empezar en blanco. Para probar el cambio de galería sin esperar, escribe en la consola `tallerAvanzar(620)`, que adelanta 620 segundos de juego.
