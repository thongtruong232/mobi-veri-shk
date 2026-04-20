from functools import wraps
import logging

# Define user roles
ROLES = {
    'general': ['general', 'admin', 'quanly', 'kiemtra', 'nhanvien'],
    'admin': ['admin', 'quanly', 'kiemtra', 'nhanvien'],
    'quanly': ['quanly', 'kiemtra', 'nhanvien'],
    'kiemtra': ['kiemtra', 'nhanvien'],
    'nhanvien': ['nhanvien']
}

logger = logging.getLogger(__name__)


def role_required(roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

def can_manage_users(user_role):
    """Check if user can manage other users"""
    return user_role in ['admin', 'quanly']

def can_update_status(user_role):
    """Check if user can update status"""
    return user_role in ROLES

# def get_allowed_status_updates(user_role):
#     """Get list of status updates allowed for user"""
#     return ALLOWED_STATUS_UPDATES.get(user_role, []) 