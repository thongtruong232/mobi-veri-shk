"""
Phase 5: Constants Module for Manage Admin Feature

This module centralizes all constants, magic strings, and configuration values
to improve maintainability and reduce duplication across the codebase.
"""

from typing import Dict, List, Tuple

# =============================================================================
# STATUS CONSTANTS
# =============================================================================

class AccountStatus:
    """Account status constants for TextNow and TextFree"""
    SUCCESS = 'success'
    ERROR = 'error'
    VERIFIED = 'verified'
    RESEND_LINK = 'resend link'
    OTHER_PASSWORD = 'other password'
    NOT_REG = 'not reg'
    VERIFIED_ERROR = 'verified error'
    
    # Lists for validation and filtering
    ALL_TN_STATUSES: List[str] = [
        SUCCESS, ERROR, VERIFIED, RESEND_LINK, OTHER_PASSWORD, NOT_REG, VERIFIED_ERROR
    ]
    
    ALL_TF_STATUSES: List[str] = [
        SUCCESS, ERROR, RESEND_LINK, OTHER_PASSWORD, NOT_REG, VERIFIED_ERROR
    ]
    
    # Statuses to exclude from statistics
    EXCLUDE_FROM_STATS_TN: List[str] = [ERROR, VERIFIED_ERROR, NOT_REG, SUCCESS]
    EXCLUDE_FROM_STATS_TF: List[str] = [ERROR, VERIFIED_ERROR, NOT_REG]
    
    # Sellable statuses
    SELLABLE_TN: List[str] = [VERIFIED]
    SELLABLE_TF: List[str] = [SUCCESS]
    
    # Error statuses
    ERROR_STATUSES: List[str] = [ERROR, VERIFIED_ERROR]


class ItemType:
    """Item type constants"""
    ALL = 'all'
    TEXTNOW = 'textnow'
    TEXTFREE = 'textfree'
    
    VALID_TYPES: List[str] = [ALL, TEXTNOW, TEXTFREE]


class DateType:
    """Date filter type constants"""
    SINGLE = 'single'
    RANGE = 'range'
    
    VALID_TYPES: List[str] = [SINGLE, RANGE]


# =============================================================================
# DATABASE CONSTANTS
# =============================================================================

class Collections:
    """MongoDB collection names"""
    EMPLOYEE_TEXTNOW = 'employee_textnow'
    USERS = 'users'
    SESSIONS = 'sessions'
    ORDERS = 'orders'
    ICLOUDS = 'iclouds'
    EMPLOYEE_WORKSESSION = 'employee_worksession'
    STATS = 'stats'


class EmployeeFields:
    """Field names for employee_textnow collection"""
    ID = '_id'
    EMAIL = 'email'
    PASSWORD_EMAIL = 'password_email'
    PASS_TN = 'pass_TN'
    PASS_TF = 'pass_TF'
    STATUS_ACCOUNT_TN = 'status_account_TN'
    STATUS_ACCOUNT_TF = 'status_account_TF'
    SOLD_STATUS_TN = 'sold_status_TN'
    SOLD_STATUS_TF = 'sold_status_TF'
    CREATED_AT = 'created_at'
    CREATED_BY = 'created_by'
    OFFICE = 'office'
    AREA_PHONE = 'area_phone'
    FULL_INFORMATION = 'full_information'


# Standard projection for employee queries (reusable)
EMPLOYEE_PROJECTION: Dict[str, int] = {
    EmployeeFields.ID: 1,
    EmployeeFields.EMAIL: 1,
    EmployeeFields.PASSWORD_EMAIL: 1,
    EmployeeFields.PASS_TN: 1,
    EmployeeFields.PASS_TF: 1,
    EmployeeFields.STATUS_ACCOUNT_TN: 1,
    EmployeeFields.STATUS_ACCOUNT_TF: 1,
    EmployeeFields.SOLD_STATUS_TN: 1,
    EmployeeFields.SOLD_STATUS_TF: 1,
    EmployeeFields.CREATED_AT: 1,
    EmployeeFields.CREATED_BY: 1,
    EmployeeFields.FULL_INFORMATION: 1,
}


# =============================================================================
# CACHE CONSTANTS
# =============================================================================

class CacheTimeouts:
    """Cache timeout values in seconds"""
    CREATORS = 300          # 5 minutes
    OFFICES = 600           # 10 minutes
    STATUS_LIST = 600       # 10 minutes
    STATISTICS = 60         # 1 minute
    DISTINCT = 300          # 5 minutes
    WAREHOUSE_STATS = 30    # 30 seconds


class CacheKeys:
    """Cache key prefixes and patterns"""
    PREFIX = 'manage_admin'
    CREATORS = f'{PREFIX}:creators'
    OFFICES = f'{PREFIX}:offices'
    STATUS_LIST = f'{PREFIX}:status_list'
    STATISTICS = f'{PREFIX}:stats'
    DISTINCT = f'{PREFIX}:distinct'
    WAREHOUSE_TN = 'warehouse_stats_textnow'
    WAREHOUSE_TF = 'warehouse_stats_textfree'


# =============================================================================
# API CONSTANTS
# =============================================================================

class APILimits:
    """API rate limiting and pagination constants"""
    # Rate limiting
    DEFAULT_RATE_LIMIT = 100        # requests per window
    DEFAULT_RATE_WINDOW = 60        # seconds
    
    EXPORT_RATE_LIMIT = 10          # Excel export limit
    EXPORT_RATE_WINDOW = 60         # per minute
    
    WAREHOUSE_RATE_LIMIT = 60       # Warehouse API limit
    WAREHOUSE_RATE_WINDOW = 60      # per minute
    
    # Pagination
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 500
    WAREHOUSE_DEFAULT_PAGE_SIZE = 100
    
    # Export
    MAX_EXPORT_SIZE = 1000          # Maximum records per export


class HTTPStatus:
    """HTTP status codes for consistency"""
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    METHOD_NOT_ALLOWED = 405
    TOO_MANY_REQUESTS = 429
    INTERNAL_ERROR = 500


# =============================================================================
# DISPLAY CONSTANTS
# =============================================================================

class BadgeClasses:
    """Bootstrap badge classes for status display"""
    STATUS_BADGE_MAP: Dict[str, str] = {
        AccountStatus.SUCCESS: 'bg-success',
        AccountStatus.ERROR: 'bg-danger',
        AccountStatus.VERIFIED: 'bg-info',
        AccountStatus.RESEND_LINK: 'bg-purple',
        AccountStatus.OTHER_PASSWORD: 'bg-warning',
        AccountStatus.NOT_REG: 'bg-secondary',
        AccountStatus.VERIFIED_ERROR: 'bg-danger',
    }
    
    DEFAULT = 'bg-secondary'
    
    @classmethod
    def get_badge_class(cls, status: str) -> str:
        """Get badge class for a status value"""
        return cls.STATUS_BADGE_MAP.get(status, cls.DEFAULT)


class CheckliveStatus:
    """Checklive status display values"""
    LIVE = 'Live'
    OVER_7_DAYS = 'Quá 7 ngày'
    OVER_9_DAYS = 'Quá 9 ngày'
    
    # Thresholds in days
    WARNING_THRESHOLD = 7
    CRITICAL_THRESHOLD = 9
    
    @classmethod
    def get_status(cls, days: int) -> str:
        """Get checklive status based on days"""
        if days > cls.CRITICAL_THRESHOLD:
            return cls.OVER_9_DAYS
        elif days >= cls.WARNING_THRESHOLD:
            return cls.OVER_7_DAYS
        return cls.LIVE


# =============================================================================
# ERROR MESSAGES
# =============================================================================

class ErrorMessages:
    """Standardized error messages"""
    DB_CONNECTION_ERROR = 'Unable to connect to database'
    COLLECTION_ACCESS_ERROR = 'Unable to access collection'
    LOGIN_REQUIRED = 'Please login to continue'
    INVALID_ITEM_TYPE = 'Invalid item type'
    INVALID_REQUEST_METHOD = 'Unsupported request method'
    RATE_LIMIT_EXCEEDED = 'Rate limit exceeded. Try again later.'
    EXPORT_SIZE_EXCEEDED = f'Cannot export more than {APILimits.MAX_EXPORT_SIZE} records at once'
    RECORD_NOT_FOUND = 'Record not found'
    DELETE_FAILED = 'Failed to delete record'
    UPDATE_FAILED = 'Failed to update record'


# =============================================================================
# DATE FORMAT CONSTANTS
# =============================================================================

class DateFormats:
    """Date format strings"""
    ISO_DATE = '%Y-%m-%d'
    ISO_DATETIME = '%Y-%m-%d %H:%M:%S'
    DISPLAY_DATE = '%d/%m/%Y'
    DISPLAY_DATETIME = '%d/%m/%Y %H:%M:%S'
    FILENAME_DATE = '%d_%m_%Y'
