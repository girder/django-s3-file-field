import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "s3ff_example.settings")

application = get_wsgi_application()
