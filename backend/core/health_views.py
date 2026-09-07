"""
Health check endpoint for Render.
Returns 200 if the app and database are reachable.
No authentication required — used by Render's startup and liveness checks.
"""
from django.http import JsonResponse
from django.db import connection


def health_check(request):
    """
    GET /api/health/
    Returns {"status": "ok", "db": "ok"} when healthy.
    Returns 503 with {"status": "error", "db": "unavailable"} on DB failure.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
        http_status = 200
    except Exception as e:
        db_status = f"unavailable: {str(e)}"
        http_status = 503

    return JsonResponse(
        {"status": "ok" if http_status == 200 else "error", "db": db_status},
        status=http_status,
    )
