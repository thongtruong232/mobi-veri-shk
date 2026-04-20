from django.conf import settings
from authentication.office_utils import get_all_offices


def debug_context(request):
    """Expose DEBUG setting to templates for conditional asset loading."""
    return {'DEBUG': settings.DEBUG}


def user_data_context(request):
    return {'user_data': getattr(request, '_session_data', {})}


def offices_context(request):
    try:
        return {'offices': get_all_offices()}
    except Exception:
        return {'offices': []}