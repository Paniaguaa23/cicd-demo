#!/usr/bin/env bash
# Prueba de humo: verifica que la URL responda y que sirva la versión esperada.
# Uso: smoke-test.sh <url> <version-esperada>
set -euo pipefail

URL="$1"
ESPERADA="$2"

for intento in $(seq 1 12); do
  if RESP="$(curl -fsS --max-time 5 "$URL/api/info")"; then
    VERSION="$(echo "$RESP" | jq -r .version)"
    if [ "$VERSION" = "$ESPERADA" ]; then
      echo "OK: $URL sirve la versión $VERSION"
      exit 0
    fi
    echo "Intento $intento: versión $VERSION (esperada $ESPERADA); el ALB aún drena tareas viejas"
  else
    echo "Intento $intento: sin respuesta todavía"
  fi
  sleep 10
done

echo "::error::La prueba de humo falló en $URL"
exit 1
