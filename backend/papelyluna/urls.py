# ---------------------------------------------------------------------------
# urls.py (del proyecto): archivo principal de rutas.
# Todo lo que empiece por /api/ se envía a las rutas de la aplicación "pos".
# ---------------------------------------------------------------------------
from django.urls import include, path
from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health),
    path("api/", include("pos.urls")),
]
