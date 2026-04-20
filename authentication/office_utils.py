from typing import Optional
import unicodedata
import re
import logging

logger = logging.getLogger(__name__)


# Centralized office-to-collection mapping
OFFICE_TO_EMAIL_COLLECTION = {
    'Hàn Mạc Tử': 'hmt_emails',
    'Bùi Việt': 'buiviet_emails',
    'Trung Tiến': 'trungtien_emails',
    'Đà Nẵng': 'danang_emails',
}

OFFICE_TO_LONG_TERM_COLLECTION = {
    'Hàn Mạc Tử': 'long_term_hmt',
    'Bùi Việt': 'long_term_buiviet',
    'Trung Tiến': 'long_term_trungtien',
    'Đà Nẵng': 'long_term_danang',
}

OFFICE_TO_ICLOUD_COLLECTION = {
    'Hàn Mạc Tử': 'icloud_hmt',
    'Bùi Việt': 'icloud_buiviet',
    'Trung Tiến': 'icloud_trungtien',
    'Đà Nẵng': 'icloud_danang',
}

OFFICE_TO_GMAIL_RECOVERY_COLLECTION = {
    'Hàn Mạc Tử': 'gmail_recovery_hmt',
    'Bùi Việt': 'gmail_recovery_buiviet',
    'Trung Tiến': 'gmail_recovery_trungtien',
    'Đà Nẵng': 'gmail_recovery_danang',
}

# Optional: Office to OTP recipient emails mapping (centralized)
OFFICE_TO_OTP_RECIPIENTS = {
    'Hàn Mạc Tử': ['tubui15599@gmail.com', 'triqtech.customer@gmail.com', 'triqtech.global@gmail.com'],
    'Bùi Việt': ['buivjet2005@gmail.com'],
    'Trung Tiến': ['trungtien19955@gmail.com'],
    'Đà Nẵng': ['elivibes0124@gmail.com', 'triqtech.customer@gmail.com', 'triqtech.global@gmail.com'],
}


def get_email_collection_name(office: str) -> Optional[str]:
    key = _normalize_office_name(office)
    return OFFICE_TO_EMAIL_COLLECTION.get(key)


def get_long_term_collection_name(office: str) -> Optional[str]:
    key = _normalize_office_name(office)
    return OFFICE_TO_LONG_TERM_COLLECTION.get(key)


def get_icloud_collection_name(office: str) -> Optional[str]:
    key = _normalize_office_name(office)
    return OFFICE_TO_ICLOUD_COLLECTION.get(key)


def get_gmail_recovery_collection_name(office: str) -> Optional[str]:
    key = _normalize_office_name(office)
    return OFFICE_TO_GMAIL_RECOVERY_COLLECTION.get(key)


def get_collection_by_office(mongo, office: str, kind: str):
    """Return a pymongo collection by office and kind ('emails' | 'long_term' | 'icloud').

    Returns None if the mapping is not found or if mongo/db is unavailable.
    """
    try:
        if mongo is None or getattr(mongo, 'db', None) is None:
            return None
        normalized = _normalize_office_name(office)
        name = None
        if kind == 'emails':
            name = get_email_collection_name(normalized)
        elif kind == 'long_term':
            name = get_long_term_collection_name(normalized)
        elif kind == 'gmail_recovery':
            name = get_gmail_recovery_collection_name(normalized)
        elif kind == 'icloud':
            name = get_icloud_collection_name(normalized)
        if not name:
            try:
                logger.warning(
                    "[office_utils] Unsupported office mapping: kind=%s office_raw=%r office_norm=%r office_ascii=%r",
                    kind,
                    office,
                    normalized,
                    _remove_accents(normalized or '')
                )
            except Exception:
                pass
            return None
        return mongo.db.get_collection(name)
    except Exception:
        try:
            logger.exception("[office_utils] get_collection_by_office failed: kind=%s office=%r", kind, office)
        except Exception:
            pass
        return None



def get_all_offices():
    """Return a list of all supported office names.

    The list is derived from OFFICE_TO_EMAIL_COLLECTION keys to represent
    offices that are fully configured across the system.
    """
    try:
        return list(OFFICE_TO_EMAIL_COLLECTION.keys())
    except Exception:
        return []


def get_office_recipients(office: Optional[str]) -> list:
    """Return recipient email list for given office.

    Falls back to a default list if office not configured.
    """
    default_recipients = ['elivibes0124@gmail.com']
    try:
        key = _normalize_office_name(office)
        return OFFICE_TO_OTP_RECIPIENTS.get(key) or default_recipients
    except Exception:
        return default_recipients


def _normalize_office_name(office: Optional[str]) -> Optional[str]:
    """Normalize office names to canonical keys used in mapping.

    - Strips whitespace
    - Normalizes Unicode to NFC
    - Collapses multiple spaces
    - Applies alias mapping (accent-insensitive)
    """
    if not office:
        return office
    try:
        # Trim and unicode-normalize to NFC
        s = unicodedata.normalize('NFC', str(office).strip())
        # Collapse multiple spaces
        s = re.sub(r"\s+", " ", s)
        # Fast-path exact match
        if s in OFFICE_TO_EMAIL_COLLECTION:
            return s
        # Lowercase, remove accents for alias matching
        s_ascii = _remove_accents(s).lower()
        s_ascii = s_ascii.replace('-', ' ').strip()
        s_ascii = re.sub(r"\s+", " ", s_ascii)
        aliases = {
            'han mac tu': 'Hàn Mạc Tử',
            'bui viet': 'Bùi Việt',
            'trung tien': 'Trung Tiến',
            'da nang': 'Đà Nẵng',
        }
        canonical = aliases.get(s_ascii)
        if canonical and canonical in OFFICE_TO_EMAIL_COLLECTION:
            return canonical
        return s  # fallback to original normalized
    except Exception:
        return office


def _remove_accents(text: str) -> str:
    # Convert to NFD and filter out diacritical marks
    nfd = unicodedata.normalize('NFD', text)
    return ''.join(ch for ch in nfd if unicodedata.category(ch) != 'Mn')

