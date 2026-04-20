"""
Security Headers Middleware - Phase 6: Security Enhancements
Adds security headers to all responses to protect against common attacks.

Security headers added:
- X-Content-Type-Options: Prevents MIME type sniffing
- X-Frame-Options: Prevents clickjacking (Django has this, but we enhance it)
- X-XSS-Protection: Legacy XSS protection for older browsers
- Referrer-Policy: Controls referrer information
- Permissions-Policy: Controls browser features
- Content-Security-Policy: Controls resource loading (configurable)
- Strict-Transport-Security: Forces HTTPS (in production)
"""

import logging
from django.conf import settings
from django.http import HttpRequest, HttpResponse

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware:
    """
    Middleware to add security headers to all responses.
    
    Add to MIDDLEWARE in settings.py:
        'authentication.security_middleware.SecurityHeadersMiddleware',
    """
    
    # Default security headers
    DEFAULT_HEADERS = {
        # Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        # XSS Protection for legacy browsers
        'X-XSS-Protection': '1; mode=block',
        
        # Control referrer information
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        # Disable permissions/features not needed
        'Permissions-Policy': (
            'accelerometer=(), '
            'camera=(), '
            'geolocation=(), '
            'gyroscope=(), '
            'magnetometer=(), '
            'microphone=(), '
            'payment=(), '
            'usb=()'
        ),
        
        # Cache control for sensitive pages
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
    }
    
    # Headers to add only in production
    PRODUCTION_HEADERS = {
        # Force HTTPS (HSTS) - 1 year
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    }
    
    # Content Security Policy - configurable
    CSP_DEFAULT = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'self'; "
        "form-action 'self'; "
        "base-uri 'self';"
    )
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.debug = getattr(settings, 'DEBUG', False)
        
        # Get custom CSP from settings if available
        self.csp = getattr(settings, 'CONTENT_SECURITY_POLICY', self.CSP_DEFAULT)
        
        # Get paths to exclude from caching headers
        self.exclude_cache_paths = getattr(
            settings, 
            'SECURITY_EXCLUDE_CACHE_PATHS', 
            ['/static/', '/media/']
        )
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        
        # Add default security headers
        for header, value in self.DEFAULT_HEADERS.items():
            # Don't override existing headers
            if header not in response:
                # Skip cache headers for static files
                if header in ('Cache-Control', 'Pragma'):
                    if not any(request.path.startswith(p) for p in self.exclude_cache_paths):
                        response[header] = value
                else:
                    response[header] = value
        
        # Add production headers (HSTS only in production with HTTPS)
        if not self.debug:
            for header, value in self.PRODUCTION_HEADERS.items():
                if header not in response:
                    response[header] = value
        
        # Add CSP header (unless explicitly disabled)
        if self.csp and 'Content-Security-Policy' not in response:
            # Use report-only in debug mode for testing
            if self.debug:
                response['Content-Security-Policy-Report-Only'] = self.csp
            else:
                response['Content-Security-Policy'] = self.csp
        
        return response


class RateLimitMiddleware:
    """
    Global rate limiting middleware for DDoS protection.
    Uses Redis for distributed rate limiting across multiple workers.
    
    Add to MIDDLEWARE in settings.py:
        'authentication.security_middleware.RateLimitMiddleware',
    """
    
    # Default limits
    DEFAULT_LIMIT = 100  # requests per window
    DEFAULT_WINDOW = 60  # seconds
    
    # Paths with custom limits
    CUSTOM_LIMITS = {
        '/api/': {'limit': 60, 'window': 60},
        '/login/': {'limit': 10, 'window': 60},
        '/export/': {'limit': 5, 'window': 60},
    }
    
    # Paths to exclude from rate limiting
    EXCLUDE_PATHS = [
        '/static/',
        '/media/',
        '/health/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.debug = getattr(settings, 'DEBUG', False)
        
        # Get Redis client
        try:
            from django.core.cache import cache
            self.cache = cache
            self.enabled = True
        except Exception as e:
            logger.warning(f"Rate limiting disabled: {e}")
            self.enabled = False
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Skip if disabled or excluded path
        if not self.enabled:
            return self.get_response(request)
            
        if any(request.path.startswith(p) for p in self.EXCLUDE_PATHS):
            return self.get_response(request)
        
        # Get client identifier
        client_id = self._get_client_id(request)
        
        # Get rate limit for this path
        limit, window = self._get_limit_for_path(request.path)
        
        # Check rate limit
        if self._is_rate_limited(client_id, request.path, limit, window):
            logger.warning(f"Rate limit exceeded for {client_id} on {request.path}")
            
            response = HttpResponse(
                '{"status": "error", "message": "Rate limit exceeded. Please try again later."}',
                content_type='application/json',
                status=429
            )
            response['Retry-After'] = str(window)
            return response
        
        return self.get_response(request)
    
    def _get_client_id(self, request: HttpRequest) -> str:
        """Get unique client identifier (IP + User if authenticated)"""
        # Get IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        
        # Add user ID if authenticated
        session_data = getattr(request, '_session_data', None)
        if session_data:
            user_id = session_data.get('user_id', '')
            return f"{ip}:{user_id}"
        
        return ip
    
    def _get_limit_for_path(self, path: str) -> tuple:
        """Get rate limit configuration for path"""
        for prefix, config in self.CUSTOM_LIMITS.items():
            if path.startswith(prefix):
                return config['limit'], config['window']
        
        return self.DEFAULT_LIMIT, self.DEFAULT_WINDOW
    
    def _is_rate_limited(self, client_id: str, path: str, limit: int, window: int) -> bool:
        """Check if client has exceeded rate limit"""
        try:
            # Create cache key
            # Normalize path to first segment for grouping
            path_key = path.split('/')[1] if '/' in path else path
            cache_key = f"ratelimit:{client_id}:{path_key}"
            
            # Get current count
            current = self.cache.get(cache_key, 0)
            
            if current >= limit:
                return True
            
            # Increment counter
            if current == 0:
                self.cache.set(cache_key, 1, window)
            else:
                self.cache.incr(cache_key)
            
            return False
            
        except Exception as e:
            logger.error(f"Rate limit check error: {e}")
            return False  # Fail open - don't block on errors


class RequestLoggingMiddleware:
    """
    Security audit logging middleware.
    Logs all requests for security monitoring.
    
    Add to MIDDLEWARE in settings.py:
        'authentication.security_middleware.RequestLoggingMiddleware',
    """
    
    # Paths to exclude from logging (high frequency, low security value)
    EXCLUDE_PATHS = [
        '/static/',
        '/media/',
        '/health/',
        '/favicon.ico',
    ]
    
    # Sensitive paths to always log with details
    SENSITIVE_PATHS = [
        '/login/',
        '/logout/',
        '/admin/',
        '/export/',
        '/delete/',
        '/update/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger('security.audit')
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Skip excluded paths
        if any(request.path.startswith(p) for p in self.EXCLUDE_PATHS):
            return self.get_response(request)
        
        # Get request details
        request_data = self._get_request_data(request)
        
        # Process request
        response = self.get_response(request)
        
        # Log based on path sensitivity and response status
        is_sensitive = any(request.path.startswith(p) for p in self.SENSITIVE_PATHS)
        is_error = response.status_code >= 400
        
        if is_sensitive or is_error:
            request_data['status_code'] = response.status_code
            request_data['response_size'] = len(response.content) if hasattr(response, 'content') else 0
            
            if is_error:
                self.logger.warning(f"Request Error: {request_data}")
            else:
                self.logger.info(f"Sensitive Request: {request_data}")
        
        return response
    
    def _get_request_data(self, request: HttpRequest) -> dict:
        """Extract request data for logging"""
        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        
        # Get user info
        session_data = getattr(request, '_session_data', None)
        username = session_data.get('username', 'anonymous') if session_data else 'anonymous'
        
        return {
            'ip': ip,
            'user': username,
            'method': request.method,
            'path': request.path,
            'query': request.META.get('QUERY_STRING', '')[:200],
            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
            'referer': request.META.get('HTTP_REFERER', '')[:200],
        }


class SQLInjectionProtectionMiddleware:
    """
    Additional protection against SQL/NoSQL injection attempts.
    Checks request parameters for suspicious patterns.
    
    Note: This is a defense-in-depth measure. Primary protection should be
    through parameterized queries and input validation.
    """
    
    # Suspicious patterns for NoSQL injection
    SUSPICIOUS_PATTERNS = [
        '$where',
        '$gt',
        '$lt',
        '$ne',
        '$or',
        '$and',
        '$regex',
        '$nin',
        '$in',
        'function(',
        'javascript:',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Check query parameters
        query_string = request.META.get('QUERY_STRING', '').lower()
        
        for pattern in self.SUSPICIOUS_PATTERNS:
            if pattern in query_string:
                logger.warning(
                    f"Suspicious pattern in query string: {pattern} "
                    f"from {request.META.get('REMOTE_ADDR')}"
                )
                return HttpResponse(
                    '{"status": "error", "message": "Invalid request"}',
                    content_type='application/json',
                    status=400
                )
        
        # Check POST body for JSON requests
        if request.method == 'POST' and request.content_type == 'application/json':
            try:
                body = request.body.decode('utf-8').lower()
                for pattern in self.SUSPICIOUS_PATTERNS:
                    if pattern in body:
                        logger.warning(
                            f"Suspicious pattern in POST body: {pattern} "
                            f"from {request.META.get('REMOTE_ADDR')}"
                        )
                        return HttpResponse(
                            '{"status": "error", "message": "Invalid request"}',
                            content_type='application/json',
                            status=400
                        )
            except:
                pass
        
        return self.get_response(request)
