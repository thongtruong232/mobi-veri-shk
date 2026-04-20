
import time
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from contextlib import contextmanager
from authentication.mongodb import MongoDBConnection
from authentication.utils import get_current_time
import logging

logger = logging.getLogger(__name__)

class LockManager:
    """Quản lý lock cho các tài nguyên trong hệ thống"""
    
    def __init__(self):
        self._locks = {}  # In-memory locks
        self._thread_lock = threading.Lock()  # Thread-safe access to _locks
        self._lock_timeout = 30  # 30 giây timeout
        self._cleanup_interval = 60  # 1 phút cleanup
        self._last_cleanup = time.time()
        self._lock_stats = {
            'total_acquired': 0,
            'total_released': 0,
            'timeout_count': 0,
            'conflict_count': 0,
            'average_hold_time': 0
        }
    
    def _cleanup_expired_locks(self):
        """Dọn dẹp các lock đã hết hạn"""
        current_time = time.time()
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        expired_keys = []
        for key, lock_info in self._locks.items():
            if current_time - lock_info['timestamp'] > self._lock_timeout:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self._locks[key]
            logger.warning(f"Expired lock removed: {key}")
        
        self._last_cleanup = current_time
    
    def acquire_lock(self, resource_key: str, user_id: str, timeout: int = 30, priority: int = 2) -> bool:
        """
        Lấy lock cho một tài nguyên với priority
        
        Args:
            resource_key: Khóa định danh tài nguyên (vd: "email:test@example.com")
            user_id: ID của user đang yêu cầu lock
            timeout: Thời gian timeout (giây)
            priority: Độ ưu tiên (1=cao, 2=trung bình, 3=thấp)
        
        Returns:
            bool: True nếu lấy được lock, False nếu không
        """
        with self._thread_lock:
            self._cleanup_expired_locks()
            
            current_time = time.time()
            
            # Kiểm tra xem tài nguyên đã bị lock chưa
            if resource_key in self._locks:
                lock_info = self._locks[resource_key]
                # Kiểm tra xem lock có hết hạn không
                if current_time - lock_info['timestamp'] < self._lock_timeout:
                    # Lock vẫn còn hiệu lực
                    if lock_info['user_id'] == user_id:
                        # Cùng user, refresh timestamp
                        lock_info['timestamp'] = current_time
                        self._lock_stats['total_acquired'] += 1
                        return True
                    else:
                        # User khác đang giữ lock - check priority
                        if priority < lock_info.get('priority', 2):
                            # Higher priority, force acquire
                            logger.warning(f"High priority lock acquired: {resource_key} by {user_id} (overriding {lock_info['user_id']})")
                            self._lock_stats['conflict_count'] += 1
                        else:
                            # Lower or same priority, deny
                            self._lock_stats['conflict_count'] += 1
                            return False
            
            # Lấy lock mới
            self._locks[resource_key] = {
                'user_id': user_id,
                'timestamp': current_time,
                'created_at': get_current_time().isoformat(),
                'priority': priority,
                'acquire_time': current_time
            }
            
            self._lock_stats['total_acquired'] += 1
            logger.info(f"Lock acquired: {resource_key} by {user_id} (priority: {priority})")
            return True
    
    def release_lock(self, resource_key: str, user_id: str) -> bool:
        """
        Giải phóng lock
        
        Args:
            resource_key: Khóa định danh tài nguyên
            user_id: ID của user đang giữ lock
        
        Returns:
            bool: True nếu giải phóng thành công
        """
        with self._thread_lock:
            if resource_key in self._locks:
                lock_info = self._locks[resource_key]
                if lock_info['user_id'] == user_id:
                    # Calculate hold time for statistics
                    hold_time = time.time() - lock_info.get('acquire_time', time.time())
                    self._lock_stats['total_released'] += 1
                    
                    # Update average hold time
                    total_operations = self._lock_stats['total_acquired'] + self._lock_stats['total_released']
                    if total_operations > 0:
                        current_avg = self._lock_stats['average_hold_time']
                        self._lock_stats['average_hold_time'] = (current_avg + hold_time) / 2
                    
                    del self._locks[resource_key]
                    logger.info(f"Lock released: {resource_key} by {user_id} (held for {hold_time:.2f}s)")
                    return True
                else:
                    logger.warning(f"Lock release denied: {resource_key} not owned by {user_id}")
                    return False
            return True  # Lock không tồn tại, coi như đã giải phóng
    
    def get_lock_stats(self) -> Dict[str, Any]:
        """Lấy thống kê về locks"""
        return self._lock_stats.copy()
    
    def get_active_locks(self) -> Dict[str, Dict[str, Any]]:
        """Lấy danh sách locks đang hoạt động"""
        current_time = time.time()
        active_locks = {}
        
        for key, lock_info in self._locks.items():
            if current_time - lock_info['timestamp'] < self._lock_timeout:
                active_locks[key] = {
                    'user_id': lock_info['user_id'],
                    'created_at': lock_info['created_at'],
                    'priority': lock_info.get('priority', 2),
                    'age': current_time - lock_info['timestamp'],
                    'hold_time': current_time - lock_info.get('acquire_time', lock_info['timestamp'])
                }
        
        return active_locks
    
    def is_locked(self, resource_key: str) -> bool:
        """Kiểm tra xem tài nguyên có bị lock không"""
        self._cleanup_expired_locks()
        
        if resource_key not in self._locks:
            return False
        
        lock_info = self._locks[resource_key]
        current_time = time.time()
        
        # Kiểm tra timeout
        if current_time - lock_info['timestamp'] > self._lock_timeout:
            del self._locks[resource_key]
            return False
        
        return True
    
    def get_lock_info(self, resource_key: str) -> Optional[Dict[str, Any]]:
        """Lấy thông tin về lock hiện tại"""
        if resource_key in self._locks:
            lock_info = self._locks[resource_key].copy()
            lock_info['age'] = time.time() - lock_info['timestamp']
            return lock_info
        return None

# Global lock manager instance
lock_manager = LockManager()

@contextmanager
def acquire_resource_lock(resource_key: str, user_id: str, timeout: int = 30, priority: int = 2):
    """
    Context manager để tự động quản lý lock
    
    Usage:
        with acquire_resource_lock("email:test@example.com", "user123"):
            # Thao tác với tài nguyên
            pass
    """
    acquired = False
    try:
        acquired = lock_manager.acquire_lock(resource_key, user_id, timeout, priority)
        if not acquired:
            raise ResourceLockedException(f"Resource {resource_key} is locked by another user")
        yield
    finally:
        if acquired:
            lock_manager.release_lock(resource_key, user_id)

@contextmanager
def acquire_db_resource_lock(resource_key: str, user_id: str, timeout: int = 30, max_retries: int = 5, retry_delay: float = 0.3):
    """
    Context manager sử dụng MongoDB-based distributed lock (cross-process safe).
    Retries with exponential backoff before raising ResourceLockedException.
    
    Usage:
        with acquire_db_resource_lock("office:HMT", "user123", timeout=60):
            # Critical section — serialized across all workers
            pass
    """
    db_lock_manager = DatabaseLockManager()
    acquired = False
    try:
        for attempt in range(max_retries):
            acquired = db_lock_manager.acquire_lock(resource_key, user_id, timeout)
            if acquired:
                break
            if attempt < max_retries - 1:
                delay = retry_delay * (2 ** attempt)  # Exponential backoff
                logger.info(f"DB lock retry {attempt + 1}/{max_retries} for {resource_key} by {user_id}, waiting {delay:.1f}s")
                time.sleep(delay)
        
        if not acquired:
            raise ResourceLockedException(f"Resource {resource_key} is locked by another user (after {max_retries} retries)")
        yield
    finally:
        if acquired:
            db_lock_manager.release_lock(resource_key, user_id)

@contextmanager
def acquire_read_lock(resource_key: str, user_id: str, timeout: int = 30):
    """
    Context manager để tự động quản lý read lock
    
    Usage:
        with acquire_read_lock("worksession:user123", "user123"):
            # Đọc dữ liệu
            pass
    """
    acquired = False
    try:
        acquired = read_write_lock_manager.acquire_read_lock(resource_key, user_id, timeout)
        if not acquired:
            raise ResourceLockedException(f"Resource {resource_key} is write-locked by another user")
        yield
    finally:
        if acquired:
            read_write_lock_manager.release_read_lock(resource_key, user_id)

@contextmanager
def acquire_write_lock(resource_key: str, user_id: str, timeout: int = 30):
    """
    Context manager để tự động quản lý write lock
    
    Usage:
        with acquire_write_lock("worksession:user123", "user123"):
            # Ghi dữ liệu
            pass
    """
    acquired = False
    try:
        acquired = read_write_lock_manager.acquire_write_lock(resource_key, user_id, timeout)
        if not acquired:
            raise ResourceLockedException(f"Resource {resource_key} is locked by another user")
        yield
    finally:
        if acquired:
            read_write_lock_manager.release_write_lock(resource_key, user_id)

class ResourceLockedException(Exception):
    """Exception khi không thể lấy được lock"""
    pass

class DatabaseLockManager:
    """Quản lý lock sử dụng MongoDB để hỗ trợ multiple server instances"""
    
    @staticmethod
    def acquire_lock(resource_key: str, user_id: str, timeout: int = 30) -> bool:
        """
        Lấy lock sử dụng MongoDB atomic operations.
        Uses _id = resource_key for natural uniqueness (no duplicate inserts).
        
        Args:
            resource_key: Khóa định danh tài nguyên
            user_id: ID của user
            timeout: Thời gian timeout (giây)
        
        Returns:
            bool: True nếu lấy được lock
        """
        try:
            with MongoDBConnection() as mongo:
                if mongo is None or mongo.db is None:
                    return False
                
                db = mongo.db
                locks_collection = db['resource_locks']
                current_time = get_current_time()
                expire_time = current_time + timedelta(seconds=timeout)
                
                # Atomic find_one_and_update: acquire lock if expired or same user
                result = locks_collection.find_one_and_update(
                    {
                        '_id': resource_key,
                        '$or': [
                            {'expire_at': {'$lt': current_time.isoformat()}},
                            {'user_id': user_id}
                        ]
                    },
                    {
                        '$set': {
                            'user_id': user_id,
                            'created_at': current_time.isoformat(),
                            'expire_at': expire_time.isoformat(),
                        }
                    },
                    upsert=False,
                    return_document=True
                )
                
                if result is not None:
                    return True
                
                # Lock document doesn't exist yet — try to insert
                try:
                    locks_collection.insert_one({
                        '_id': resource_key,
                        'user_id': user_id,
                        'created_at': current_time.isoformat(),
                        'expire_at': expire_time.isoformat(),
                    })
                    return True
                except Exception:
                    # DuplicateKeyError: another process inserted first — lock held
                    return False
                
        except Exception as e:
            logger.error(f"Error acquiring database lock: {str(e)}")
            return False
    
    @staticmethod
    def release_lock(resource_key: str, user_id: str) -> bool:
        """Giải phóng lock trong MongoDB"""
        try:
            with MongoDBConnection() as mongo:
                if mongo is None or mongo.db is None:
                    return False
                
                db = mongo.db
                locks_collection = db['resource_locks']
                
                result = locks_collection.delete_one({
                    '_id': resource_key,
                    'user_id': user_id
                })
                
                return result.deleted_count > 0
                
        except Exception as e:
            logger.error(f"Error releasing database lock: {str(e)}")
            return False
    
    @staticmethod
    def cleanup_expired_locks():
        """Dọn dẹp các lock đã hết hạn trong MongoDB"""
        try:
            with MongoDBConnection() as mongo:
                if mongo is None or mongo.db is None:
                    return
                
                db = mongo.db
                locks_collection = db['resource_locks']
                current_time = get_current_time().isoformat()
                
                result = locks_collection.delete_many({
                    'expire_at': {'$lt': current_time}
                })
                
                if result.deleted_count > 0:
                    logger.info(f"Cleaned up {result.deleted_count} expired locks")
                    
        except Exception as e:
            logger.error(f"Error cleaning up expired locks: {str(e)}")

# Hybrid lock manager - sử dụng cả in-memory và database
class HybridLockManager:
    """Kết hợp in-memory và database locking"""
    
    def __init__(self):
        self.local_manager = lock_manager
        self.db_manager = DatabaseLockManager()
    
    def acquire_lock(self, resource_key: str, user_id: str, timeout: int = 30) -> bool:
        """Thử local lock trước, nếu fail thì thử database lock"""
        # Thử local lock trước (nhanh hơn)
        if self.local_manager.acquire_lock(resource_key, user_id, timeout):
            return True
        
        # Nếu local lock fail, thử database lock
        if self.db_manager.acquire_lock(resource_key, user_id, timeout):
            return True
        
        return False
    
    def release_lock(self, resource_key: str, user_id: str) -> bool:
        """Giải phóng cả local và database lock"""
        local_result = self.local_manager.release_lock(resource_key, user_id)
        db_result = self.db_manager.release_lock(resource_key, user_id)
        return local_result or db_result

# Read-Write Lock Manager
class ReadWriteLockManager:
    """Quản lý Read-Write locks để tối ưu concurrency"""
    
    def __init__(self):
        self._read_locks = {}  # Multiple readers allowed
        self._write_locks = {}  # Exclusive write access
        self._lock_timeout = 30
        self._cleanup_interval = 60
        self._last_cleanup = time.time()
    
    def acquire_read_lock(self, resource_key: str, user_id: str, timeout: int = 30) -> bool:
        """Acquire read lock (multiple readers allowed)"""
        self._cleanup_expired_locks()
        
        # Check if write lock exists
        if resource_key in self._write_locks:
            write_lock = self._write_locks[resource_key]
            if time.time() - write_lock['timestamp'] < self._lock_timeout:
                if write_lock['user_id'] != user_id:
                    return False  # Write lock held by another user
        
        # Add to read locks
        if resource_key not in self._read_locks:
            self._read_locks[resource_key] = {}
        
        self._read_locks[resource_key][user_id] = {
            'timestamp': time.time(),
            'created_at': get_current_time().isoformat()
        }
        
        logger.debug(f"Read lock acquired: {resource_key} by {user_id}")
        return True
    
    def acquire_write_lock(self, resource_key: str, user_id: str, timeout: int = 30) -> bool:
        """Acquire write lock (exclusive access)"""
        self._cleanup_expired_locks()
        
        # Check if any read locks exist
        if resource_key in self._read_locks:
            for reader_id, lock_info in self._read_locks[resource_key].items():
                if time.time() - lock_info['timestamp'] < self._lock_timeout:
                    if reader_id != user_id:
                        return False  # Read locks held by other users
        
        # Check if write lock exists
        if resource_key in self._write_locks:
            write_lock = self._write_locks[resource_key]
            if time.time() - write_lock['timestamp'] < self._lock_timeout:
                if write_lock['user_id'] != user_id:
                    return False  # Write lock held by another user
        
        # Acquire write lock
        self._write_locks[resource_key] = {
            'user_id': user_id,
            'timestamp': time.time(),
            'created_at': get_current_time().isoformat()
        }
        
        logger.info(f"Write lock acquired: {resource_key} by {user_id}")
        return True
    
    def release_read_lock(self, resource_key: str, user_id: str) -> bool:
        """Release read lock"""
        if resource_key in self._read_locks and user_id in self._read_locks[resource_key]:
            del self._read_locks[resource_key][user_id]
            if not self._read_locks[resource_key]:  # No more readers
                del self._read_locks[resource_key]
            logger.debug(f"Read lock released: {resource_key} by {user_id}")
            return True
        return False
    
    def release_write_lock(self, resource_key: str, user_id: str) -> bool:
        """Release write lock"""
        if resource_key in self._write_locks:
            write_lock = self._write_locks[resource_key]
            if write_lock['user_id'] == user_id:
                del self._write_locks[resource_key]
                logger.info(f"Write lock released: {resource_key} by {user_id}")
                return True
        return False
    
    def _cleanup_expired_locks(self):
        """Cleanup expired locks"""
        current_time = time.time()
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        # Cleanup read locks
        for resource_key in list(self._read_locks.keys()):
            for user_id in list(self._read_locks[resource_key].keys()):
                if current_time - self._read_locks[resource_key][user_id]['timestamp'] > self._lock_timeout:
                    del self._read_locks[resource_key][user_id]
            if not self._read_locks[resource_key]:
                del self._read_locks[resource_key]
        
        # Cleanup write locks
        for resource_key in list(self._write_locks.keys()):
            if current_time - self._write_locks[resource_key]['timestamp'] > self._lock_timeout:
                del self._write_locks[resource_key]
        
        self._last_cleanup = current_time

# Global instances
read_write_lock_manager = ReadWriteLockManager()
hybrid_lock_manager = HybridLockManager()

# Utility functions
def get_email_lock_key(email: str) -> str:
    """Tạo lock key cho email"""
    return f"email:{email}"

def get_worksession_lock_key(user_id: str, date: str = None) -> str:
    """Tạo lock key cho worksession"""
    if date is None:
        date = get_current_time().strftime('%Y-%m-%d')
    return f"worksession:{user_id}:{date}"

def get_office_lock_key(office: str) -> str:
    """Tạo lock key cho office"""
    return f"office:{office}"
