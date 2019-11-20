from typing import Any, List

from django.urls import path

from .views import finalize_upload, prepare_upload

urlpatterns = [
    path('prepare-upload/', prepare_upload),
    path('finalize-upload/', finalize_upload),
]


def add_url_patterns(patterns: List[Any], prefix='api/joist'):
    patterns.append(path(prefix, urlpatterns))
