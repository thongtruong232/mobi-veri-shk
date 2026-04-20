from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST
from django.shortcuts import render
from authentication.mongodb import MongoDBConnection
from authentication.office_utils import (
    get_collection_by_office,
    get_email_collection_name,
    get_long_term_collection_name,
)
import logging
import json
from rest_framework.decorators import api_view
import requests
from authentication.utils import format_date_for_display, get_current_time, safe_parse_date_only
from datetime import datetime
from authentication.locking_mechanism import (
    acquire_write_lock,
    ResourceLockedException,
    get_worksession_lock_key
)
import re

logger = logging.getLogger(__name__)

_ttl_indexes_ensured = set()

def _ensure_employee_textnow_ttl_index(collection):
    """Ensure TTL index on employee_textnow.created_at_ttl exists once per process.

    Avoids calling index_information() on every request. We cache by collection name.
    """
    try:
        if collection.name in _ttl_indexes_ensured:
            return
        # One-time check on process start for existing TTL index
        info = collection.index_information()
        has_ttl = any(
            idx.get('key') == [('created_at_ttl', 1)] and idx.get('expireAfterSeconds') == 2592000
            for idx in info.values()
        )
        if not has_ttl:
            collection.create_index([('created_at_ttl', 1)], expireAfterSeconds=2592000, name='created_at_ttl_ttl_30d')
        _ttl_indexes_ensured.add(collection.name)
    except Exception:
        # Do not crash the request if index creation fails; it only affects TTL cleanup
        logger.exception('Failed to ensure TTL index for collection %s', getattr(collection, 'name', 'unknown'))

@csrf_exempt
@require_http_methods(["POST"])
def update_textnow_status_api(request):
    try:
        # Lấy dữ liệu từ request
        data = json.loads(request.body)

        email = data.get('email')
        status_account_TN = data.get('status_account_TN')
        status_account_TF = data.get('status_account_TF')
        # Lấy session data từ request
        session_data = getattr(request, '_session_data', None)
        if not session_data:
            return JsonResponse({
                'success': False,
                'error': 'Please login to continue'
            }, status=401)
        
        if not email:
            return JsonResponse({
                'success': False,
                'error': 'Email cannot be empty'
            }, status=400)

        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to MongoDB'
                }, status=500)
            
            db = mongo.db
            employee_textnow_collection = db['employee_textnow']
            user_data = session_data
            if not user_data:
                return JsonResponse({
                    'success': False,
                    'error': 'User information not found'
                }, status=404)
        
            office = user_data.get('office', '')
            textnow_collection = get_collection_by_office(mongo, office, 'emails')
            if not office:
                return JsonResponse({'success': False, 'error': 'Unable to determine your office'}, status=400)
            if textnow_collection is None:
                return JsonResponse({'success': False, 'error': f'Unsupported office: {office}'}, status=400)

            # Tạo update query
            update_query = {'$set': {}}
            
            if status_account_TN is not None:
                update_query['$set']['status_account_TN'] = status_account_TN
            if status_account_TF is not None:
                update_query['$set']['status_account_TF'] = status_account_TF
            
            # Thêm updated_at vào update query
            update_query['$set']['updated_at'] = get_current_time().isoformat()

            # Thực hiện update
            result = employee_textnow_collection.update_one(
                {'email': email},
                update_query
            )
            textnow_collection.update_one(
                {'email': email},
                update_query
            )
            if result.matched_count == 0:
                return render(request, 'authentication/error.html', {
                    'message': 'Email not found in system'
                }, status=404)

            return JsonResponse({
                'success': True,
                'message': 'Updated status successfully'
            })

    except json.JSONDecodeError:
        return render(request, 'authentication/error.html', {
            'message': 'Invalid data'
        }, status=400)
    except Exception as e:
        logger.error(f"Error in update_textnow_status_api: {str(e)}", exc_info=True)
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def save_icloud_accounts(request):
    try:
        data = json.loads(request.body)
        accounts = data.get('accounts', [])
        office = data.get('office')

        if not isinstance(accounts, list) or not accounts:
            return JsonResponse({'success': False, 'error': 'Invalid accounts data'})

        if not office:
            return JsonResponse({'success': False, 'error': 'Office is required'})

        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to MongoDB'})

            db = mongo.db
            # Chọn collection theo office (icloud)
            collection = get_collection_by_office(mongo, office, 'icloud')
            if collection is None:
                return JsonResponse({'success': False, 'error': f'Unsupported office: {office}'})

            if collection is None:
                return JsonResponse({'success': False, 'error': 'Unable to access collection'})

            # Chuẩn hóa và lọc trùng theo id
            existing_ids = set(collection.distinct('id'))
            to_insert = []
            duplicate_ids = []
            now_iso = get_current_time().isoformat()
            for acc in accounts:
                acc_id = (acc.get('id') or '').strip()
                if not acc_id or acc_id in existing_ids:
                    if acc_id:
                        duplicate_ids.append(acc_id)
                    continue
                
                to_insert.append({
                    'id': acc_id,
                    'password': (acc.get('password') or '').strip(),
                    'numberphone': (acc.get('numberphone') or '').strip(),
                    'otp_link': (acc.get('otp_link') or '').strip(),
                    'status': 'chưa sử dụng',
                    'created_at': now_iso
                })

            inserted_count = 0
            if to_insert:
                result = collection.insert_many(to_insert)
                inserted_count = len(result.inserted_ids)

            return JsonResponse({
                'success': True,
                'inserted_count': inserted_count,
                'duplicate_ids': duplicate_ids
            })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'})
    except Exception as e:
        logger.error(f"Error in save_icloud_accounts: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)})

@require_http_methods(['GET'])
def fmail_list(request):
    try:
        apikey = request.GET.get('apikey')
        api_url = 'https://fmail1s.com/api/products.php'
        params = {
            'api_key': apikey
        }
        response = requests.get(api_url, params=params)
        data = response.json()
        # Chuẩn hóa response
        if data.get('status') == 'success' and 'categories' in data:
            formatted_data = []
            for category in data['categories']:
                for product in category.get('products', []):
                    formatted_data.append({
                        'id': product.get('id'),
                        'name': product.get('name'),
                        'price': int(product.get('price', 0)),
                        'quality': int(product.get('amount', 0))
                    })
            return JsonResponse({'success': True, 'data': formatted_data})
        else:
            return render(request, 'authentication/error.html', {
                'message': data.get('msg', 'API error')
            }, status=400)
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def fmail_buy(request):
    try:
        apikey = request.GET.get('apikey')
        product_id = request.POST.get('id')
        amount = request.POST.get('amount')
        if not product_id or not amount:
            return render(request, 'authentication/error.html', {
                'message': 'Missing parameters'
            }, status=400)
        api_url = 'https://fmail1s.com/api/buy_product'
        params = {
            'action': 'buyProduct',
            'api_key': apikey,
            'id': product_id,
            'amount': amount
        }
        response = requests.get(api_url, params=params)
        data = response.json()
        return JsonResponse(data)
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
def fmail_balance(request):
    import requests
    try:
        apikey = request.GET.get('apikey')
        api_url = 'https://fmail1s.com/api/profile.php'
        params = {
            'api_key': apikey
        }
        response = requests.get(api_url, params=params)
        data = response.json()
        print('data fmail', data)
        # Chuẩn hóa trả về
        money = None
        if data.get('status') == 'success' and 'money' in data:
            money = int(data['money'])
        elif 'data' in data and 'money' in data['data']:
            money = int(data['data']['money'])
        return JsonResponse({'success': True, 'data': {'money': money}})
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
def phapsu_list(request):
    import requests
    try:
        apikey = request.GET.get('apikey')
        api_url = 'https://phapsummo.net/api/products.php'
        params = {
            'api_key': apikey
        }
        response = requests.get(api_url, params=params)
        data = response.json()
        # Chuẩn hóa response
        if data.get('status') == 'success' and 'categories' in data:
            formatted_data = []
            for category in data['categories']:
                for product in category.get('products', []):
                    formatted_data.append({
                        'id': product.get('id'),
                        'name': product.get('name'),
                        'price': int(product.get('price', 0)),
                        'quality': int(product.get('amount', 0))
                    })
            return JsonResponse({'success': True, 'data': formatted_data})
        else:
            return render(request, 'authentication/error.html', {
                'message': data.get('msg', 'API error')
            }, status=400)
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def phapsu_buy(request):
    import requests
    try:
        apikey = request.GET.get('apikey')
        product_id = request.POST.get('id')
        amount = request.POST.get('amount')
        if not product_id or not amount:
            return render(request, 'authentication/error.html', {
                'message': 'Thiếu tham số'
            }, status=400)
        # TODO: Thay thế API URL và params thực tế cho Pháp Sư
        api_url = 'https://phapsummo.net/api/buy_product'  # placeholder, bạn thay sau
        params = {
            'action': 'buyProduct',
            'api_key': apikey,  # placeholder
            'id': product_id,
            'amount': amount
        }
        response = requests.get(api_url, params=params)
        data = response.json()
        return JsonResponse(data)
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
def phapsu_balance(request):
    import requests
    try:
        apikey = request.GET.get('apikey')
        api_url = 'https://phapsummo.net/api/profile.php'
        params = {
            'api_key': apikey
        }
        response = requests.get(api_url, params=params)
        data = response.json()
        # Chuẩn hóa trả về
        money = None
        if data.get('status') == 'success' and 'money' in data:
            money = int(data['money'])
        elif 'data' in data and 'money' in data['data']:
            money = int(data['data']['money'])
        return JsonResponse({'success': True, 'data': {'money': money}})
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
def dongvan_balance(request):
    import requests
    try:
        apikey = request.GET.get('apikey')
        api_url = f'https://api.dongvanfb.net/user/balance?apikey={apikey}'
        response = requests.get(api_url)
        data = response.json()
        # Chuẩn hóa trả về
        money = None
        if data.get('status') == True and 'balance' in data:
            money = int(data['balance'])
        return JsonResponse({'success': True, 'data': {'money': money}})
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)


