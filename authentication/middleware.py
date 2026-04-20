from django.db import close_old_connections
from django.conf import settings
import logging
import time
import redis
from django.contrib.messages.middleware import MessageMiddleware
from authentication.permissions import ROLES

logger = logging.getLogger(__name__)

class ConnectionManagementMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # 5 phút
        self.idle_timeout = 600  # 10 phút
        self._redis_pool = None

    def _get_redis_pool(self):
        """Get or create Redis connection pool"""
        if self._redis_pool is None:
            self._redis_pool = redis.ConnectionPool(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                max_connections=100,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
        return self._redis_pool

    def _get_redis_client(self):
        """Get Redis client from pool"""
        return redis.Redis(connection_pool=self._get_redis_pool())

    def __call__(self, request):
        # Đóng các kết nối Django DB cũ
        close_old_connections()

        # Kiểm tra và dọn dẹp kết nối định kỳ
        current_time = time.time()
        if current_time - self.last_cleanup > self.cleanup_interval:
            try:
                self.cleanup_connections()
                self.last_cleanup = current_time
            except Exception as e:
                logger.error(f"Error cleaning up connections: {str(e)}")

        response = self.get_response(request)
        return response

    def cleanup_connections(self):
        """Cleanup all connections"""
        try:
            # Cleanup MongoDB connections
            MongoDBConnection.cleanup()

            # Cleanup Redis connections
            redis_client = self._get_redis_client()
            redis_client.ping()  # Test connection
            
            # Close idle Redis connections
            redis_client.connection_pool.disconnect()
            
            logger.info("Successfully cleaned up all connections")
        except Exception as e:
            logger.error(f"Error in cleanup_connections: {str(e)}")
            raise

    def process_exception(self, request, exception):
        """Handle exceptions and cleanup connections"""
        try:
            self.cleanup_connections()
        except Exception as e:
            logger.error(f"Error cleaning up connections after exception: {str(e)}")
        return None

class MongoDBAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.message_middleware = MessageMiddleware(get_response)

    def __call__(self, request):
        # Tạo một class giả để mô phỏng Django User
        class MongoUser:
            def __init__(self, session_data):
                self.username = session_data.get('username')
                self.role = session_data.get('role')
                self.id = session_data.get('user_id')
                self._is_active = session_data.get('is_active', True)
                self.office = session_data.get('office', '')

            def has_perm(self, perm):
                if not self.role or self.role not in ROLES:
                    return False
                allowed_roles = ROLES.get(self.role, [])
                if perm == 'admin':
                    return 'admin' in allowed_roles
                elif perm == 'quanly':
                    return any(role in allowed_roles for role in ['admin', 'quanly'])
                elif perm == 'kiemtra':
                    return any(role in allowed_roles for role in ['admin', 'quanly', 'kiemtra'])
                elif perm == 'nhanvien':
                    return any(role in allowed_roles for role in ['admin', 'quanly', 'kiemtra', 'nhanvien'])
                return False

            @property
            def is_active(self):
                return self._is_active

            @property
            def is_anonymous(self):
                return False

            @property
            def is_authenticated(self):
                return True

        request._session_data = {
            'username': getattr(settings, 'DEFAULT_USERNAME', 'admin'),
            'office': getattr(settings, 'DEFAULT_OFFICE', ''),
            'role': 'general',
            'is_active': True,
        }
        request.user = MongoUser(request._session_data)
        return self.message_middleware(request)