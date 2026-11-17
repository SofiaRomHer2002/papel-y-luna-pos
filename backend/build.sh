#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python -m pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
# Solo crea usuarios ausentes; conserva claves, roles y cuentas desactivadas.
python manage.py inicializar_datos --solo-usuarios
