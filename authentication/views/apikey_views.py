from django.shortcuts import render
from django.http import JsonResponse
from authentication.mongodb import MongoDBConnection
from authentication.permissions import ROLES
import logging

logger = logging.getLogger(__name__)

def save_apikey_dongvan(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to database'}, status=500)
            # Lấy thông tin người dùng
            db = mongo.db
            user_data = request._session_data
            office = user_data.get('office')

            # Lấy apikey từ collection tương ứng
            apikey_collection = db['apikeys']
            existing_doc = apikey_collection.find_one({'office': f'{office}'})
            if existing_doc:
                # Nếu tìm thấy, cập nhật các trường
                update_data = {
                    'api_dongvan': request.POST.get('key'),
                }
                apikey_collection.update_one(
                    {'office': f'{office}'},
                    {'$set': update_data}
                )
            else:
                # Nếu không tìm thấy, tạo mới document
                new_doc = {
                    'office': f'{office}',
                    'api_dongvan': request.POST.get('key'),
                }
                apikey_collection.insert_one(new_doc)

            # Lấy lại document sau khi cập nhật/tạo mới
            updated_doc = apikey_collection.find_one({'office': f'{office}'})

            return JsonResponse({
                'success': True,
                'key': updated_doc.get('api_dongvan', '') if updated_doc else '',
            })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

def save_apikey_phapsu(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to database'}, status=500)
            db = mongo.db
            user_data = request._session_data
            office = user_data.get('office')

            # Lấy apikey từ collection tương ứng
            apikey_collection = db['apikeys']
            existing_doc = apikey_collection.find_one({'office': f'{office}'})
            if existing_doc:
                # Nếu tìm thấy, cập nhật các trường
                update_data = {
                    'api_phapsu': request.POST.get('key'),
                }
                apikey_collection.update_one(
                    {'office': f'{office}'},
                    {'$set': update_data}
                )
            else:
                # Nếu không tìm thấy, tạo mới document
                new_doc = {
                    'office': f'{office}',
                    'api_phapsu': request.POST.get('key'),
                }
                apikey_collection.insert_one(new_doc)

            # Lấy lại document sau khi cập nhật/tạo mới
            updated_doc = apikey_collection.find_one({'office': f'{office}'})

            return JsonResponse({
                'success': True,
                'key': updated_doc.get('api_phapsu', '') if updated_doc else '',
            })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

def save_apikey_fmail(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to database'}, status=500)
            db = mongo.db
            user_data = request._session_data
            office = user_data.get('office')

            # Lấy apikey từ collection tương ứng
            apikey_collection = db['apikeys']
            existing_doc = apikey_collection.find_one({'office': f'{office}'})
            if existing_doc:
                # Nếu tìm thấy, cập nhật các trường
                update_data = {
                    'api_fmail': request.POST.get('key'),
                }
                apikey_collection.update_one(
                    {'office': f'{office}'},
                    {'$set': update_data}
                )
            else:
                # Nếu không tìm thấy, tạo mới document
                new_doc = {
                    'office': f'{office}',
                    'api_fmail': request.POST.get('key'),
                }
                apikey_collection.insert_one(new_doc)

            # Lấy lại document sau khi cập nhật/tạo mới
            updated_doc = apikey_collection.find_one({'office': f'{office}'})

            return JsonResponse({
                'success': True,
                'key': updated_doc.get('api_fmail', '') if updated_doc else '',
            })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


def get_user_office(request):
    """API endpoint to get current user's office"""
    try:
        session_data = request._session_data
        
        office = session_data.get('office', '')
        return JsonResponse({
            'success': True,
            'office': office
        })
    except Exception as e:
        logger.error(f"Error in get_user_office: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def get_api_data(request):
    """API endpoint to get API keys for current user's office"""
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to database'}, status=500)
            
            session_data = request._session_data
            
            db = mongo.db
            office = session_data.get('office', '')
            apikey_collection = db['apikeys']
            api_data = apikey_collection.find_one({'office': office})
            
            return JsonResponse({
                'success': True,
                'api_dongvan': api_data.get('api_dongvan', '') if api_data else '',
                'api_fmail': api_data.get('api_fmail', '') if api_data else '',
                'api_phapsu': api_data.get('api_phapsu', '') if api_data else ''
            })
    except Exception as e:
        logger.error(f"Error in get_api_data: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def get_reserve_mail_count(request):
    """API endpoint to get reserve mail count for current user's office"""
    try:
        from authentication.office_utils import get_long_term_collection_name
        
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to database'}, status=500)
            
            session_data = request._session_data
            
            db = mongo.db
            office = session_data.get('office', '')
            
            # Get the long term collection name for this office
            collection_name = get_long_term_collection_name(office)
            if not collection_name:
                return JsonResponse({
                    'success': True,
                    'count': 0
                })
            
            # Count available emails (not assigned to any user)
            collection = db[collection_name]
            count = collection.count_documents({
                '$or': [
                    {'assigned_to': {'$exists': False}},
                    {'assigned_to': None},
                    {'assigned_to': ''}
                ]
            })
            
            return JsonResponse({
                'success': True,
                'count': count
            })
    except Exception as e:
        logger.error(f"Error in get_reserve_mail_count: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e), 'count': 0}, status=500)