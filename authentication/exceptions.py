"""
Phase 5: Custom Exceptions Module

This module provides custom exception classes for better error handling
and more informative error messages throughout the application.
"""

from typing import Optional, Dict, Any


class BaseAppException(Exception):
    """Base exception class for all application exceptions"""
    
    default_message = "An unexpected error occurred"
    default_code = "UNKNOWN_ERROR"
    default_status = 500
    
    def __init__(
        self, 
        message: Optional[str] = None, 
        code: Optional[str] = None,
        status: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.status = status or self.default_status
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response"""
        result = {
            'success': False,
            'status': 'error',
            'message': self.message,
            'error_code': self.code,
        }
        if self.details:
            result['details'] = self.details
        return result


# =============================================================================
# DATABASE EXCEPTIONS
# =============================================================================

class DatabaseException(BaseAppException):
    """Base exception for database-related errors"""
    default_message = "Database error occurred"
    default_code = "DATABASE_ERROR"
    default_status = 500


class DatabaseConnectionError(DatabaseException):
    """Raised when unable to connect to database"""
    default_message = "Unable to connect to database"
    default_code = "DB_CONNECTION_ERROR"


class CollectionAccessError(DatabaseException):
    """Raised when unable to access a collection"""
    default_message = "Unable to access collection"
    default_code = "COLLECTION_ACCESS_ERROR"
    
    def __init__(self, collection_name: str, **kwargs):
        self.collection_name = collection_name
        message = f"Unable to access collection: {collection_name}"
        super().__init__(message=message, **kwargs)


class RecordNotFoundError(DatabaseException):
    """Raised when a requested record is not found"""
    default_message = "Record not found"
    default_code = "RECORD_NOT_FOUND"
    default_status = 404
    
    def __init__(self, record_id: Optional[str] = None, **kwargs):
        self.record_id = record_id
        message = f"Record not found: {record_id}" if record_id else self.default_message
        super().__init__(message=message, **kwargs)


class DuplicateRecordError(DatabaseException):
    """Raised when attempting to create a duplicate record"""
    default_message = "Record already exists"
    default_code = "DUPLICATE_RECORD"
    default_status = 409


# =============================================================================
# AUTHENTICATION EXCEPTIONS
# =============================================================================

class AuthenticationException(BaseAppException):
    """Base exception for authentication-related errors"""
    default_message = "Authentication error"
    default_code = "AUTH_ERROR"
    default_status = 401


class LoginRequiredError(AuthenticationException):
    """Raised when user is not authenticated"""
    default_message = "Please login to continue"
    default_code = "LOGIN_REQUIRED"


class InsufficientPermissionsError(AuthenticationException):
    """Raised when user lacks required permissions"""
    default_message = "You do not have permission to perform this action"
    default_code = "INSUFFICIENT_PERMISSIONS"
    default_status = 403
    
    def __init__(self, required_role: Optional[str] = None, **kwargs):
        self.required_role = required_role
        if required_role:
            message = f"This action requires '{required_role}' role"
            kwargs['message'] = message
        super().__init__(**kwargs)


class SessionExpiredError(AuthenticationException):
    """Raised when user session has expired"""
    default_message = "Your session has expired. Please login again."
    default_code = "SESSION_EXPIRED"


# =============================================================================
# VALIDATION EXCEPTIONS
# =============================================================================

class ValidationException(BaseAppException):
    """Base exception for validation-related errors"""
    default_message = "Validation error"
    default_code = "VALIDATION_ERROR"
    default_status = 400


class InvalidInputError(ValidationException):
    """Raised when input validation fails"""
    default_message = "Invalid input provided"
    default_code = "INVALID_INPUT"
    
    def __init__(self, field: Optional[str] = None, reason: Optional[str] = None, **kwargs):
        self.field = field
        self.reason = reason
        
        if field and reason:
            message = f"Invalid value for '{field}': {reason}"
        elif field:
            message = f"Invalid value for '{field}'"
        else:
            message = self.default_message
            
        super().__init__(message=message, **kwargs)


class MissingFieldError(ValidationException):
    """Raised when a required field is missing"""
    default_message = "Required field is missing"
    default_code = "MISSING_FIELD"
    
    def __init__(self, field: str, **kwargs):
        self.field = field
        message = f"Required field is missing: {field}"
        super().__init__(message=message, **kwargs)


class InvalidItemTypeError(ValidationException):
    """Raised when an invalid item type is provided"""
    default_message = "Invalid item type"
    default_code = "INVALID_ITEM_TYPE"
    
    def __init__(self, item_type: str, valid_types: Optional[list] = None, **kwargs):
        self.item_type = item_type
        self.valid_types = valid_types
        
        message = f"Invalid item type: '{item_type}'"
        if valid_types:
            message += f". Valid types: {', '.join(valid_types)}"
            
        super().__init__(message=message, **kwargs)


class InvalidDateRangeError(ValidationException):
    """Raised when date range is invalid"""
    default_message = "Invalid date range"
    default_code = "INVALID_DATE_RANGE"


class InvalidObjectIdError(ValidationException):
    """Raised when an invalid MongoDB ObjectId is provided"""
    default_message = "Invalid object ID"
    default_code = "INVALID_OBJECT_ID"
    
    def __init__(self, object_id: Optional[str] = None, **kwargs):
        self.object_id = object_id
        if object_id:
            message = f"Invalid object ID: {object_id}"
        else:
            message = self.default_message
        super().__init__(message=message, **kwargs)


# =============================================================================
# RATE LIMITING EXCEPTIONS
# =============================================================================

class RateLimitException(BaseAppException):
    """Raised when rate limit is exceeded"""
    default_message = "Rate limit exceeded. Please try again later."
    default_code = "RATE_LIMIT_EXCEEDED"
    default_status = 429
    
    def __init__(self, retry_after: Optional[int] = None, **kwargs):
        self.retry_after = retry_after
        if retry_after:
            message = f"Rate limit exceeded. Try again in {retry_after} seconds."
            kwargs['message'] = message
        super().__init__(**kwargs)


# =============================================================================
# BUSINESS LOGIC EXCEPTIONS
# =============================================================================

class BusinessLogicException(BaseAppException):
    """Base exception for business logic errors"""
    default_message = "Business rule violation"
    default_code = "BUSINESS_ERROR"
    default_status = 400


class ExportSizeExceededError(BusinessLogicException):
    """Raised when export size limit is exceeded"""
    default_message = "Export size limit exceeded"
    default_code = "EXPORT_SIZE_EXCEEDED"
    
    def __init__(self, requested: int, max_allowed: int, **kwargs):
        self.requested = requested
        self.max_allowed = max_allowed
        message = f"Cannot export {requested} records. Maximum allowed: {max_allowed}"
        super().__init__(message=message, **kwargs)


class OperationFailedError(BusinessLogicException):
    """Raised when an operation fails"""
    default_message = "Operation failed"
    default_code = "OPERATION_FAILED"
    
    def __init__(self, operation: str, reason: Optional[str] = None, **kwargs):
        self.operation = operation
        self.reason = reason
        
        message = f"Failed to {operation}"
        if reason:
            message += f": {reason}"
            
        super().__init__(message=message, **kwargs)


# =============================================================================
# EXTERNAL SERVICE EXCEPTIONS
# =============================================================================

class ExternalServiceException(BaseAppException):
    """Base exception for external service errors"""
    default_message = "External service error"
    default_code = "EXTERNAL_SERVICE_ERROR"
    default_status = 502


class ServiceUnavailableError(ExternalServiceException):
    """Raised when an external service is unavailable"""
    default_message = "Service temporarily unavailable"
    default_code = "SERVICE_UNAVAILABLE"
    default_status = 503


class ServiceTimeoutError(ExternalServiceException):
    """Raised when external service times out"""
    default_message = "Service request timed out"
    default_code = "SERVICE_TIMEOUT"
    default_status = 504
