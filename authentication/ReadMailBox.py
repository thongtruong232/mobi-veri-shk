import requests
import logging
from fastapi import FastAPI
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from .circuit_breaker import oauth_breaker

logger = logging.getLogger(__name__)

class ReadMailBox:
    def __init__(self, clientiD, refresh_token, targetmail):
        self.clientID = clientiD
        self.refresh_token = refresh_token 
        self.targetmail = targetmail
        
        # Configure session with retry strategy and timeouts
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def GetAccessToken(self):
        def _get_token():
            token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            data = {
                "client_id": self.clientID,
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
                "scope": "https://graph.microsoft.com/.default",
            }
            
            logger.info(f"Requesting access token for {self.targetmail}")
            response = self.session.post(token_url, data=data, timeout=10)
            response.raise_for_status()
            
            access_token = response.json().get("access_token")
            if not access_token:
                logger.error(f"No access token received for {self.targetmail}")
                raise Exception("No access token received")
                
            logger.info(f"Successfully obtained access token for {self.targetmail}")
            return access_token
        
        try:
            # Use circuit breaker for OAuth calls
            return oauth_breaker.call(_get_token)
        except requests.exceptions.Timeout:
            logger.error(f"Timeout getting access token for {self.targetmail}")
            return "ERROR"
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error getting access token for {self.targetmail}: {e}")
            return "ERROR"
        except Exception as e:
            logger.error(f"Unexpected error getting access token for {self.targetmail}: {e}")
            return "ERROR"


# FastAPI app
app = FastAPI()
