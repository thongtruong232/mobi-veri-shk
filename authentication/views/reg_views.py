from django.http import JsonResponse
from authentication.utils import get_current_time
from datetime import datetime
from rest_framework.decorators import api_view
from django.views.decorators.csrf import csrf_exempt
from authentication.mongodb import MongoDBConnection
from authentication.office_utils import get_collection_by_office
from django.shortcuts import render
from django.views.decorators.http import require_http_methods
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from authentication.circuit_breaker import graph_api_breaker, imap_api_breaker
import re
from bs4 import Tag
from bs4 import BeautifulSoup
from authentication.ReadMailBox import ReadMailBox
from authentication.locking_mechanism import (
    acquire_resource_lock, 
    acquire_db_resource_lock,
    acquire_read_lock,
    acquire_write_lock,
    ResourceLockedException,
    get_worksession_lock_key,
    get_office_lock_key
)
import json
logger = logging.getLogger(__name__)


def _require_session_user(request):
    try:
        session_data = getattr(request, '_session_data', None)
        if not session_data:
            return None, render(request, 'authentication/error.html', {
                'message': 'Please login to continue'
            }, status=400)
        user_data = session_data
        if not user_data:
            return None, render(request, 'authentication/error.html', {
                'message': 'User information not found'
            }, status=400)
        return user_data, None
    except Exception as e:
        return None, render(request, 'authentication/error.html', {
            'message': f'An error occurred: {str(e)}'
        }, status=500)


def _parse_positive_int(value, default_value):
    try:
        parsed = int(value)
        if parsed <= 0:
            return default_value
        return parsed
    except Exception:
        return None


@api_view(['GET'])
def check_employee_password_today(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to MongoDB'
                }, status=500)
            
            collection = mongo.get_collection('employee_passwordregproduct')
            if collection is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to access collection'
                }, status=500)

            # Lấy ngày hiện tại
            today = get_current_time().strftime('%d/%m/%Y')
            
            # Tìm bản ghi với use_at là ngày hôm nay
            employee_password = collection.find_one({
                'use_at': today,
                'type': 'TextFree'
            })
            
            if employee_password is not None:
                employee_password = collection.find_one({
                    'use_at': today,
                    'type': 'TextNow'
                })
                if employee_password is not None:
                    return JsonResponse({
                        'success': True,
                        'has_record': True,
                        'message': 'Checked record successfully'
                    }, status=200)
                else:
                    return JsonResponse({
                        'success': False,
                        'error': 'Unable to find Tn password for today'
                    }, status=400)
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to find Tf password for today'
                }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def get_employee_passwords(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to MongoDB'
                }, status=500)
            
            collection = mongo.get_collection('employee_passwordregproduct')

            users_collection = mongo.get_collection('users')

            if users_collection is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to access users collection'
                }, status=500)
            user_data = users_collection.find_one({'username': request.user.username})
            if user_data is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to find user information'
                }, status=400)
            office = user_data.get('office', '')
            if collection is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to access collection'
                }, status=500)

            # Lấy ngày hiện tại
            today = get_current_time().strftime('%d/%m/%Y')
            
            # Tìm bản ghi với use_at là ngày hôm nay và type là TextNow
            employee_password_Tn = collection.find_one({
                'use_at': today,
                'type': 'TextNow',
                'office': office
            })
            
            employee_password_Tf = collection.find_one({
                'use_at': today,
                'type': 'TextFree',
                'office': office
            })

            if employee_password_Tn is not None or employee_password_Tf is not None:
                return JsonResponse({
                    'success': True,
                    'pass_TN': employee_password_Tn['password'] if employee_password_Tn is not None else None,
                    'pass_TF': employee_password_Tf['password'] if employee_password_Tf is not None else None,
                    'message': 'Retrieved password successfully'
                }, status=200)
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to find password for today'
                }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@api_view(['POST'])
def delete_all_employee_emails(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to MongoDB'
                }, status=500)
            
            users_collection = mongo.get_collection('users')
            if users_collection is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to access collection users'
                }, status=500)
            # Lấy session data từ request
            user_data, error_response = _require_session_user(request)
            if error_response:
                if isinstance(error_response, type(render(request, 'authentication/error.html'))):
                    return JsonResponse({'success': False, 'error': 'Please login to continue'}, status=400)
                return error_response
            
            office = user_data.get('office', '')
            office_collections = get_collection_by_office(mongo, office, 'emails')
            if not office:
                return JsonResponse({'success': False, 'error': 'Unable to determine your office.'}, status=400)
            if office_collections is None:
                return JsonResponse({'success': False, 'error': f'Not supported office: {office}'}, status=400)
            
            if office_collections is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to access collection emails'
                }, status=500)
                
            result = office_collections.delete_many({
                '$or': [
                    # Xóa tất cả documents không có trường long_term
                    {'long_term': {'$exists': False}},
                    # Với documents có long_term, chỉ xóa những documents có status khác "new"
                    {
                        'long_term': {'$exists': True},
                        '$and': [
                            {'status_account_TN': {'$ne': 'new'}},
                            {'status_account_TF': {'$ne': 'new'}}
                        ]
                    }
                ]
            })
            return JsonResponse({'success': True, 'deleted_count': result.deleted_count}, status=200)
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
def get_code_tn_view(request):
    try:
        if request.method == 'POST':
            email_data = request.POST.get('email_data', '')
            if not email_data:
                return JsonResponse({'success': False, 'error': 'Missing email data'})
            # Parse email_data: email|password|refresh_token|client_id
            parts = email_data.split('|')
            if len(parts) < 4:
                return JsonResponse({'success': False, 'error': 'Invalid email data'})
            email = parts[0].strip()
            refresh_token = parts[2].strip()
            client_id = parts[3].strip()
            logging.info(f"[TN][REQ] start email={email} client_id={client_id[:6] + '...' if client_id else ''}")
            # Use async processing with timeout
            from authentication.async_email_processor import email_processor
            results = email_processor.read_mail_with_timeout(
                email, refresh_token, client_id, 1, request, 'tn_type', timeout=25
            )
            try:
                cnt = 0
                if isinstance(results, dict) and isinstance(results.get('results'), list):
                    cnt = len(results['results'])
                logging.info(f"[TN][RES] email={email} results_count={cnt} error={results.get('error') if isinstance(results, dict) else None}")
                logging.info(f'[TN][RES] results={results}')
            except Exception:
                pass
            return JsonResponse({
                'success': True,
                'email_user': {'address': email, 'index': 1},
                'results': results
            })
        return JsonResponse({'success': False, 'error': 'Only POST supported'})
    except Exception as e:
        logging.error(f"[TN][ERR] get_code_tn_view: {e}")
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

def read_mail_tn(email, refresh_token, client_id, email_index, request):
    try:

        # IMAP first
        try:
            logging.info(f"[TN][IMAP][START] email={email}")
            result_imap = read_mail_imap(email, refresh_token, client_id, email_index, request, 'tn_type')
            if result_imap.get('results') and isinstance(result_imap['results'], list) and len(result_imap['results']) > 0:
                logging.info(f"[TN][IMAP][HIT] email={email} count={len(result_imap['results'])}")
                return result_imap
        except Exception as e:
            logging.error(f"[TN][IMAP][ERR] {e}")
        # Graph API
        try:
            logging.info(f"[TN][GRAPH][START] email={email}")
            result_graph = read_mail_graph(email, refresh_token, client_id, email_index, request, 'tn_type')
            if result_graph.get('results') and isinstance(result_graph['results'], list) and len(result_graph['results']) > 0:
                logging.info(f"[TN][GRAPH][HIT] email={email} count={len(result_graph['results'])}")
                return result_graph
        except Exception as e:
            logging.error(f"[TN][GRAPH][ERR] {e}")
        return {'results': [], 'error': None}
    except Exception as e:
        logging.error(f"[TN][ERR] read_mail_tn: {e}")
        return {'results': [], 'error': str(e)}


def read_mail_graph(email, refresh_token, client_id, email_index, request, type_mail):
    def _call_graph_api():
        reader = ReadMailBox(client_id, refresh_token, email)
        access_token = reader.GetAccessToken()
        if access_token == "ERROR":
            raise Exception("Không lấy được access token")
        
        headers = {
            "Authorization": f"Bearer {access_token}",
        }
        
        # Add timeout and retry logic for Graph API
        session = requests.Session()
        retry_strategy = Retry(
            total=2,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        
        response = session.get("https://graph.microsoft.com/v1.0/me/messages", 
                             headers=headers, timeout=30)
        response.raise_for_status()
        return response
    
    try:
        # Use circuit breaker for Graph API calls
        response = graph_api_breaker.call(_call_graph_api)
        try:
            data = response.json()
        except Exception as parse_error:
            try:
                body_preview = response.text[:1000]
            except Exception:
                body_preview = '<unreadable>'
            logging.error(
                f"Graph API JSON parse error: {parse_error}; "
                f"status={response.status_code}; "
                f"content_type={response.headers.get('Content-Type')}; "
                f"body_preview={body_preview}"
            )
            return {'results': [], 'error': f"Graph API JSON parse error: {parse_error}"}

        results = []
        value = data.get('value', [])
        if type_mail == 'tn_type':
            logging.info(f"[TN][GRAPH][PARSE] items={len(value)}")
        for item in value:
            if not isinstance(item, dict):
                continue
            try:
                if type_mail == 'tn_type':
                    if item['from']['emailAddress']['address'] == 'noreply@notifications.textnow.com':
                        code = parse_html_tf(item['body']['content'])
                        tn_from = 'noreply@notifications.textnow.com'
                        tn_data = item['sentDateTime']
                        result = {'from': tn_from, 'code': code, 'date': tn_data}
                        results.append(result)
                        
                elif type_mail == 'tf_type':
                    if item['from']['emailAddress']['address'] == 'info@info.textfree.us':
                        code = parse_html_tf(item['body']['content'])
                        tf_from = 'info@info.textfree.us'
                        tf_data = item['sentDateTime']
                        result = {'from': tf_from, 'code': code, 'date': tf_data}
                        results.append(result)
            except Exception as e:
                logging.error(f"read_mail_graph item error: {e}")
                continue
        if type_mail == 'tn_type':
            logging.info(f"[TN][GRAPH][DONE] email={email} hits={len(results)}")
        return {'results': results, 'error': None}
    except Exception as e:
        logging.error(f"[GRAPH][ERR] {e}")
        return {'results': [], 'error': str(e)}


def read_mail_imap(email, refresh_token, client_id, email_index, request, type_mail):
    def _call_imap_api():
        url = "http://45.77.35.79:5000/api/mail/read"
        payload = {
            "Email": email,
            "RefreshToken": refresh_token,
            "ClientId": client_id
        }
        
        # Add timeout and retry logic for IMAP API
        session = requests.Session()
        retry_strategy = Retry(
            total=2,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        
        response = session.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response
    
    try:
        # Use circuit breaker for IMAP API calls
        response = imap_api_breaker.call(_call_imap_api)
        try:
            data = response.json()
        except Exception as parse_error:
            try:
                body_preview = response.text[:1000]
            except Exception:
                body_preview = '<unreadable>'
            logging.error(
                f"IMAP API JSON parse error: {parse_error}; "
                f"status={response.status_code}; "
                f"content_type={response.headers.get('Content-Type')}; "
                f"body_preview={body_preview}"
            )
            return {'results': [], 'error': f"IMAP API JSON parse error: {parse_error}"}
        results = []
        logging.info(f"[IMAP][RES] email={email} type={type_mail} items={len(data) if isinstance(data, list) else 'N/A'}")
        for item in data:
            if not isinstance(item, dict):
                continue
            try:
                if type_mail == 'tn_type':
                    if item.get('from') == 'noreply@notifications.textnow.com':
                        link = parse_beautifulshop_tn(item.get('body', ''))
                        tn_from = item.get('from', '')
                        tn_data = item.get('date', '')
                        result = {'from': tn_from, 'link': link, 'date': tn_data}
                        results.append(result)
                        if link is None:
                            code = parse_html_tf(item.get('body', ''))
                            result = {'from': tn_from, 'code': code, 'date': tn_data}
                            logging.info(f"[TN][IMAP][CODE] email={email} code={code}")
                            results.append(result)
                elif type_mail == 'tf_type':
                    if item.get('from') == 'info@info.textfree.us':
                        code = parse_html_tf(item.get('body', ''))
                        tf_from = item.get('from', '')
                        tf_data = item.get('date', '')
                        result = {'from': tf_from, 'code': code, 'date': tf_data}
                        logging.info(f"[TF][IMAP][CODE] email={email} code={code}")
                        results.append(result)
            except Exception as e:
                logging.error(f"read_mail_imap item error: {e}")
                continue
        if type_mail == 'tn_type':
            logging.info(f"[TN][IMAP][DONE] email={email} hits={len(results)}")
        return {'results': results, 'error': None}
    except Exception as e:
        logging.error(f"[IMAP][ERR] {e}")
        return {'results': [], 'error': str(e)}

def parse_multiple_data(input_string):
    try:
        # Tách chuỗi theo dấu '\n' để lấy từng dòng
        lines = [line.strip() for line in input_string.split("\n") if line.strip()]  # Loại bỏ dòng trống
        
        result = []
        for index, line in enumerate(lines, 1):  # Bắt đầu đếm từ 1
            # Tách mỗi dòng theo dấu '|'
            attributes = line.split("|")
            
            # Kiểm tra đủ thông tin
            if len(attributes) >= 4:
                # Tạo dictionary cho mỗi đối tượng
                data_object = {
                    "index": index,  # Thêm số thứ tự
                    "email": attributes[0].strip(),
                    "password": attributes[1].strip(),
                    "additional_info": attributes[2].strip(),
                    "id": attributes[3].strip()
                }
                result.append(data_object)

        return result
    except Exception as e:
        return None

def parse_beautifulshop_tn(html_content):
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        for a_tag in soup.find_all('a', href=True):
            if not isinstance(a_tag, Tag):
                continue
            # Tìm thẻ <span> bên trong <a>
            span_tag = a_tag.find('span')
            if span_tag and span_tag.get_text(strip=True) == "Verify My Email":
                # Trả về href của thẻ <a> chứa span "Verify My Email"
                return a_tag.get('href')
        return None
    except Exception:
        # Nếu có lỗi khi parse thì trả về None để tránh làm hỏng luồng xử lý
        return None