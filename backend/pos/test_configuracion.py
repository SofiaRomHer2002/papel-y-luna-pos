"""Carga la configuración real en procesos limpios, sin conectar a PostgreSQL."""
import json
import os
from pathlib import Path
import subprocess
import sys

from django.test import SimpleTestCase


class ConfiguracionProduccionTests(SimpleTestCase):
    def cargar(self, **variables):
        entorno = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "DATABASE_", "RENDER", "CORS_")) and k not in ("SECRET_KEY", "DEBUG", "ALLOWED_HOSTS")}
        entorno.update(variables)
        codigo = """
import json
from papelyluna import settings as s
print(json.dumps({
    'debug': s.DEBUG, 'hosts': s.ALLOWED_HOSTS,
    'ssl_redirect': s.SECURE_SSL_REDIRECT,
    'cors_all': getattr(s, 'CORS_ALLOW_ALL_ORIGINS', False),
    'cors': getattr(s, 'CORS_ALLOWED_ORIGINS', []),
    'engine': s.DATABASES['default']['ENGINE'],
    'db': s.DATABASES['default']['NAME'],
    'ssl': s.DATABASES['default'].get('OPTIONS', {}).get('sslmode'),
}))
"""
        return subprocess.run([sys.executable, "-c", codigo], cwd=Path(__file__).resolve().parents[1], env=entorno, capture_output=True, text=True)

    def test_produccion_exige_secret_key(self):
        resultado = self.cargar()
        self.assertNotEqual(resultado.returncode, 0)
        self.assertIn("Define SECRET_KEY", resultado.stderr)

    def test_render_exige_base_persistente(self):
        resultado = self.cargar(SECRET_KEY="test", RENDER="true")
        self.assertNotEqual(resultado.returncode, 0)
        self.assertIn("Render requiere DATABASE_URL", resultado.stderr)

    def test_url_postgres_ssl_hosts_y_cors(self):
        resultado = self.cargar(SECRET_KEY="test", RENDER="true", RENDER_EXTERNAL_HOSTNAME="api-real.onrender.com", DATABASE_URL="postgresql://test:test@localhost:5432/render_db", CORS_ORIGENES=" https://sitio-real.onrender.com/ ,https://sofiaromher2002.github.io ")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        datos = json.loads(resultado.stdout)
        self.assertEqual(datos["engine"], "django.db.backends.postgresql")
        self.assertEqual(datos["db"], "render_db")
        self.assertEqual(datos["ssl"], "require")
        self.assertIn("api-real.onrender.com", datos["hosts"])
        self.assertFalse(datos["debug"])
        self.assertFalse(datos["cors_all"])
        self.assertTrue(datos["ssl_redirect"])
        self.assertEqual(datos["cors"], ["https://sitio-real.onrender.com", "https://sofiaromher2002.github.io"])

    def test_alias_desarrollo_sigue_funcionando(self):
        resultado = self.cargar(DJANGO_DEBUG="True", DJANGO_SECRET_KEY="local-test", DJANGO_ALLOWED_HOSTS="localhost,192.168.1.10")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        datos = json.loads(resultado.stdout)
        self.assertTrue(datos["debug"])
        self.assertTrue(datos["cors_all"])
        self.assertFalse(datos["ssl_redirect"])
        self.assertIn("192.168.1.10", datos["hosts"])
