"""
Async email processing module to handle email reading operations
without blocking the main request thread.
"""
import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional
from django.core.cache import cache
from .views.reg_views import read_mail_graph, read_mail_imap

logger = logging.getLogger(__name__)

class AsyncEmailProcessor:
    """Handle email reading operations asynchronously"""
    
    def __init__(self, max_workers=20):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.cache_timeout = 300  # 5 minutes cache
    
    def _read_mail_sync(self, email: str, refresh_token: str, client_id: str, 
                       email_index: int, request, mail_type: str) -> Dict[str, Any]:
        """Synchronous wrapper for email reading"""
        try:
            start_time = time.time()
            
            if mail_type == 'tn_type':
                result = read_mail_imap(email, refresh_token, client_id, email_index, request, 'tn_type')
                if not result.get('results') or len(result.get('results', [])) == 0:
                    result = read_mail_graph(email, refresh_token, client_id, email_index, request, 'tn_type')
            else:
                result = read_mail_imap(email, refresh_token, client_id, email_index, request, 'tf_type')
                if not result.get('results') or len(result.get('results', [])) == 0:
                    result = read_mail_graph(email, refresh_token, client_id, email_index, request, 'tf_type')
            
            duration = time.time() - start_time
            logger.info(f"Email reading completed for {email} in {duration:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in async email reading for {email}: {e}")
            return {'results': [], 'error': str(e)}
    
    async def read_mail_async(self, email: str, refresh_token: str, client_id: str, 
                            email_index: int, request, mail_type: str = 'tn_type') -> Dict[str, Any]:
        """Asynchronously read email"""
        try:
            # Check cache first
            cache_key = f"email_result_{email}_{mail_type}_{hash(refresh_token)}"
            cached_result = cache.get(cache_key)
            if cached_result:
                logger.info(f"Returning cached result for {email}")
                return cached_result
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._read_mail_sync,
                email, refresh_token, client_id, email_index, request, mail_type
            )
            
            # Cache successful results
            if result.get('results') and len(result.get('results', [])) > 0:
                cache.set(cache_key, result, self.cache_timeout)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in async email reading for {email}: {e}")
            return {'results': [], 'error': str(e)}
    
    def read_mail_with_timeout(self, email: str, refresh_token: str, client_id: str, 
                             email_index: int, request, mail_type: str = 'tn_type', 
                             timeout: int = 30) -> Dict[str, Any]:
        """Read email with timeout using asyncio"""
        try:
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Run with timeout
                result = loop.run_until_complete(
                    asyncio.wait_for(
                        self.read_mail_async(email, refresh_token, client_id, email_index, request, mail_type),
                        timeout=timeout
                    )
                )
                return result
            except asyncio.TimeoutError:
                logger.error(f"Timeout reading email for {email} after {timeout}s")
                return {'results': [], 'error': f'Timeout after {timeout} seconds'}
            finally:
                loop.close()
                
        except Exception as e:
            logger.error(f"Error in timeout email reading for {email}: {e}")
            return {'results': [], 'error': str(e)}
    
    def cleanup(self):
        """Cleanup resources"""
        self.executor.shutdown(wait=True)

# Global instance
email_processor = AsyncEmailProcessor()
