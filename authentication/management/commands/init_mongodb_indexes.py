from django.core.management.base import BaseCommand
from authentication.mongodb_helpers import initialize_mongodb_indexes
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = '''
    Phase 2: Database Optimization - Initialize MongoDB indexes
    
    Khởi tạo các indexes cho MongoDB collections:
    - users: username (unique), office, is_active
    - sessions: username, is_active, user_id, expires_at (TTL)
    - employee_textnow: 
        * Single field: email, created_by, created_at, office, status_account_TN/TF, sold_status_TN/TF
        * Compound: (sold_status, status_account, created_at), (date, creator, office)
        * Text index: (email, created_by) for search
    - iclouds: is_used, assigned_to, lease_expires_at, status
    - employee_worksession: owner, created_at, TTL index
    - stats: username, date
    
    Chạy lệnh này sau khi deploy hoặc khi cần tối ưu truy vấn.
    '''
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output for each index created',
        )
    
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Phase 2: Starting MongoDB indexes initialization...'))
        self.stdout.write(self.style.NOTICE('=' * 60))
        
        try:
            initialize_mongodb_indexes()
            
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('✅ Successfully initialized all MongoDB indexes!'))
            self.stdout.write(self.style.NOTICE('\nIndexes created for:'))
            self.stdout.write('  • users collection')
            self.stdout.write('  • sessions collection')
            self.stdout.write('  • employee_textnow collection (optimized for manage_admin)')
            self.stdout.write('  • icloud collections')
            self.stdout.write('  • employee_worksession collection')
            self.stdout.write('  • stats collection')
            
            self.stdout.write(self.style.NOTICE('\n🚀 Database queries should now be faster!'))
            
        except Exception as e:
            logger.error(f'Error initializing indexes: {e}', exc_info=True)
            self.stderr.write(self.style.ERROR(f'❌ Error initializing indexes: {e}'))