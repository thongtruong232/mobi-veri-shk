from datetime import datetime, date
import logging
from django.utils import timezone
import pytz

logger = logging.getLogger(__name__)

# Định nghĩa múi giờ
TIMEZONE = pytz.timezone('Asia/Bangkok')

def safe_parse_datetime(date_string):
    """
    Parse datetime string safely, handling both formats with and without microseconds
    """
    if not date_string:
        return None
    
    try:
        # Thử format với microsecond trước
        return datetime.strptime(date_string, '%Y-%m-%dT%H:%M:%S.%f')
    except ValueError:
        try:
            # Nếu không có microsecond, thử format không có microsecond
            return datetime.strptime(date_string, '%Y-%m-%dT%H:%M:%S')
        except ValueError:
            try:
                # Thử parse chỉ với date
                return datetime.strptime(date_string[:10], '%Y-%m-%d')
            except ValueError:
                logger.warning(f"Unable to parse datetime: {date_string}")
                return None

def safe_parse_date(date_string):
    """
    Parse date string safely, handling various formats
    """
    if not date_string:
        return None
    
    try:
        # Thử parse với format đầy đủ
        return datetime.strptime(date_string, '%Y-%m-%dT%H:%M:%S.%f')
    except ValueError:
        try:
            # Thử parse với format không có microsecond
            return datetime.strptime(date_string, '%Y-%m-%dT%H:%M:%S')
        except ValueError:
            try:
                # Thử parse chỉ với date
                return datetime.strptime(date_string[:10], '%Y-%m-%d')
            except ValueError:
                logger.warning(f"Unable to parse date: {date_string}")
                return None

def safe_parse_date_only(date_string):
    """
    Parse date string safely, only for date format (YYYY-MM-DD)
    """
    if not date_string:
        return None
    
    try:
        return datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        try:
            # Thử parse với format khác
            return datetime.strptime(date_string[:10], '%Y-%m-%d').date()
        except ValueError:
            logger.warning(f"Unable to parse date: {date_string}")
            return None

def get_current_time():
    """
    Lấy thời gian hiện tại theo múi giờ Asia/Bangkok
    """
    return timezone.localtime(timezone.now(), TIMEZONE)

def format_datetime_for_display(dt):
    """
    Format datetime cho hiển thị
    """
    if not dt:
        return ''
    
    try:
        if isinstance(dt, str):
            dt = safe_parse_datetime(dt)
        
        if dt:
            return dt.strftime('%d/%m/%Y %H:%M:%S')
        return ''
    except Exception as e:
        logger.warning(f"Error formatting datetime: {e}")
        return str(dt) if dt else ''

def format_date_for_display(dt):
    """
    Format date cho hiển thị
    """
    if not dt:
        return ''
    
    try:
        if isinstance(dt, str):
            dt = safe_parse_date_only(dt)
        
        if dt:
            return dt.strftime('%d/%m/%Y')
        return ''
    except Exception as e:
        logger.warning(f"Error formatting date: {e}")
        return str(dt) if dt else ''

def get_iso_format(dt):
    """
    Lấy ISO format cho datetime
    """
    if not dt:
        return None
    
    try:
        if isinstance(dt, str):
            dt = safe_parse_datetime(dt)
        
        if dt:
            return dt.isoformat()
        return None
    except Exception as e:
        logger.warning(f"Error getting ISO format: {e}")
        return None 