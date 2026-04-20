"""
Django ASGI application configuration.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebDjango.settings')


# Only handle HTTP requests
application = get_asgi_application()
