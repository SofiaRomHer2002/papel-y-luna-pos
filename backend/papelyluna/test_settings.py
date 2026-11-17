"""SQLite en memoria SOLO para pruebas; producción conserva PostgreSQL."""
import os

os.environ.setdefault("SECRET_KEY", "test-key-never-for-production")
os.environ.setdefault("DEBUG", "True")

from .settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
SECURE_SSL_REDIRECT = False
ALLOWED_HOSTS = ["testserver", "localhost"]
