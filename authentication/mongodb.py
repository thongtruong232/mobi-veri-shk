from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout
from django.conf import settings
import logging
from typing import Optional
from pymongo.collection import Collection
from pymongo import ReadPreference
import time
from threading import Lock
import atexit
import urllib.parse

logger = logging.getLogger(__name__)

class MongoDBConnection:
    _instance = None
    _lock = Lock()
    _client = None
    _db = None
    _last_used = 0
    _connection_timeout = 30  # seconds
    _max_idle_time = 300  # 5 minutes
    _reconnect_attempts = 5
    _reconnect_delay = 2

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(MongoDBConnection, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not getattr(self, '_initialized', False):
            self._initialized = True
            self._ensure_connection()
            atexit.register(self._close_connection)

    def _ensure_connection(self):
        """Ensure we have a valid connection"""
        current_time = time.time()
        
        if (self._client is None or 
            current_time - self._last_used > self._max_idle_time):
            self._create_connection()
        else:
            # Kiểm tra health của connection hiện tại
            try:
                self._client.admin.command('ping')
            except (ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout, Exception):
                logger.warning("MongoDB connection lost, reconnecting...")
                self._create_connection()
        
        self._last_used = current_time

    def _create_connection(self):
        """Create a new MongoDB connection with optimized settings"""
        for attempt in range(self._reconnect_attempts):
            try:
                if self._client is not None:
                    self._close_connection()

                # Get MongoDB URI from settings
                uri = settings.MONGODB_URI
                
                logger.info(f"Attempting to connect to MongoDB (attempt {attempt + 1}/{self._reconnect_attempts})")
                # NOTE: URI is intentionally NOT logged to avoid leaking credentials
                
                # Create connection options
                connection_options = {
                    'host': uri,
                    'authSource': 'admin',
                    'maxPoolSize': 10,      # Giảm từ 100 → 10, đủ dùng cho Django
                    'minPoolSize': 1,       # Giảm từ 20 → 1, tránh background thread liên tục reconnect
                    'maxIdleTimeMS': 60000,
                    'waitQueueTimeoutMS': 20000,
                    'connectTimeoutMS': 30000,
                    'socketTimeoutMS': 120000,
                    'serverSelectionTimeoutMS': 30000,
                    'retryWrites': True,
                    'w': 'majority',
                    'readPreference': 'primary',
                    'retryReads': True,
                    'directConnection': False,
                    'appname': 'WebDjango',
                    'heartbeatFrequencyMS': 30000,  # Tăng từ 10s → 30s, giảm tần suất ping background
                }

                # Create client with options
                self._client = MongoClient(**connection_options)
                
                # Test connection
                self._client.admin.command('ping')
                self._db = self._client[settings.MONGODB_DATABASE]
                logger.info("Successfully created new MongoDB connection")
                return
                
            except (ConnectionFailure, ServerSelectionTimeoutError) as e:
                logger.error(f"Failed to connect to MongoDB (attempt {attempt + 1}/{self._reconnect_attempts}): {str(e)}")
                if attempt < self._reconnect_attempts - 1:
                    logger.info(f"Retrying in {self._reconnect_delay} seconds...")
                    time.sleep(self._reconnect_delay)
                else:
                    logger.error("Max retry attempts reached. Could not connect to MongoDB.")
                    raise
            except Exception as e:
                logger.error(f"Unexpected error connecting to MongoDB: {str(e)}")
                raise

    def _close_connection(self):
        """Safely close the MongoDB connection"""
        if self._client is not None:
            try:
                self._client.close()
                logger.info("Successfully closed MongoDB connection")
            except Exception as e:
                logger.error(f"Error closing MongoDB connection: {e}")
            finally:
                self._client = None
                self._db = None

    def __enter__(self):
        """Context manager entry"""
        try:
            self._ensure_connection()
            if self._client is None or self._db is None:
                logger.error("MongoDB client or database is None after connection attempt")
                raise ConnectionFailure("Failed to establish MongoDB connection")
            return self
        except Exception as e:
            logger.error(f"Error in MongoDB connection context: {str(e)}")
            raise

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self._last_used = time.time()

    @property
    def db(self):
        """Get database instance"""
        self._ensure_connection()
        return self._db

    def get_collection(self, collection_name: str) -> Optional[Collection]:
        """Get a collection with connection check"""
        try:
            self._ensure_connection()
            if self._db is not None:
                return self._db[collection_name]
            logger.error(f"Database is None when trying to get collection {collection_name}")
            return None
        except Exception as e:
            logger.error(f"Error getting collection {collection_name}: {str(e)}")
            raise

    @classmethod
    def cleanup(cls):
        """Cleanup old connections"""
        current_time = time.time()
        if (cls._client is not None and 
            current_time - cls._last_used > cls._max_idle_time):
            with cls._lock:
                if cls._client is not None:
                    cls._close_connection(cls)
                    cls._instance = None

    @classmethod
    def get_instance(cls):
        """Get singleton instance"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_connection(cls):
        """Force reset the singleton connection (use when changing connection settings)"""
        with cls._lock:
            if cls._client is not None:
                try:
                    cls._client.close()
                except Exception:
                    pass
                cls._client = None
                cls._db = None
            cls._instance = None
            logger.info("MongoDB connection reset. Will reconnect on next use.")