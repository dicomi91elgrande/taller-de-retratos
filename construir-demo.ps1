# Genera demo.html: una copia autónoma (CSS, código e imágenes dentro del archivo)
# que se abre con doble clic. Ejecuta este script después de editar los fuentes.
$dir = $PSScriptRoot
$css = Get-Content "$dir\estilos.css" -Raw -Encoding UTF8
$js  = Get-Content "$dir\juego.js" -Raw -Encoding UTF8
$img = 'data:image/jpeg;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes("$dir\assets\retratos.jpg"))
$html = Get-Content "$dir\index.html" -Raw -Encoding UTF8
$html = $html.Replace('<link rel="stylesheet" href="estilos.css">', "<style>`n$css</style>")
$html = $html.Replace('<script src="juego.js"></script>', "<script>`n" + $js.Replace("'assets/retratos.jpg'", "'$img'") + "</script>")
[IO.File]::WriteAllText("$dir\demo.html", $html, (New-Object Text.UTF8Encoding $false))
"demo.html generado ({0:N0} KB)" -f ((Get-Item "$dir\demo.html").Length / 1KB)
