from . import views
from .views import verified_views
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # TextNow Verified
    path('verified/', views.employee_verified_view, name='verified'),
    path('api/search-textnow/', views.search_textnow_api, name='search_textnow_api'),
    path('api/verified-textnow-update/', views.update_textnow_status_api, name='verified_textnow_api'),

    # Email Management
    path('api/get-reserve-mails/', views.get_reserve_mails, name='get_reserve_mails'),
    path('api/save-purchased-emails/', views.save_purchased_emails, name='save_purchased_emails'),
    path('api/delete-all-employee-emails/', views.delete_all_employee_emails, name='delete_all_employee_emails'),

    # iCloud & Gmail Recovery
    path('api/save-icloud-accounts/', views.save_icloud_accounts, name='save_icloud_accounts'),
    path('api/save-gmail-recovery-accounts/', verified_views.save_gmail_recovery_accounts, name='save_gmail_recovery_accounts'),

    # Code & Password
    path('api/check-employee-password-today/', views.check_employee_password_today, name='check_employee_password_today'),
    path('api/get-employee-passwords/', views.get_employee_passwords, name='get_employee_passwords'),
    path('api/get-code-tn/', views.get_code_tn_view, name='get_code_tn'),

    # API Key Management
    path('api/get-user-office/', views.get_user_office, name='get_user_office'),
    path('api/get-api-data/', views.get_api_data, name='get_api_data'),
    path('api/get-reserve-mail-count/', views.get_reserve_mail_count, name='get_reserve_mail_count'),
    path('api/save-apikey-dongvan/', views.save_apikey_dongvan, name='save_apikey_dongvan'),
    path('api/save-apikey-phapsu/', views.save_apikey_phapsu, name='save_apikey_phapsu'),
    path('api/save-apikey-fmail/', views.save_apikey_fmail, name='save_apikey_fmail'),

    # External Mail Services
    path('api/fmail-list/', views.fmail_list, name='fmail_list'),
    path('api/fmail-buy/', views.fmail_buy, name='fmail_buy'),
    path('api/fmail-balance/', views.fmail_balance, name='fmail_balance'),
    path('api/phapsu-buy/', views.phapsu_buy, name='phapsu_buy'),
    path('api/phapsu-balance/', views.phapsu_balance, name='phapsu_balance'),
    path('api/phapsu-list/', views.phapsu_list, name='phapsu_list'),
    path('api/dongvan-balance/', views.dongvan_balance, name='dongvan_balance'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

