from authentication.mongodb import MongoDBConnection
from authentication.office_utils import (
    get_collection_by_office,
    get_long_term_collection_name,
    OFFICE_NAMES,
)
import re
import logging
from authentication.utils import get_current_time
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from bson import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from authentication.utils import safe_parse_date_only

logger = logging.getLogger(__name__)



def employee_verified_view(request):
    # Khởi tạo indexes khi view được gọi
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return render(request, 'authentication/error.html', {
                    'message': 'Unable to connect to database'
                }, status=500)
            # Lấy session data từ request
            user_data = request._session_data
            db = mongo.db
            
            # Gán user_data vào request để các API có thể sử dụng
            request.user_data = user_data
                
            
            office = user_data.get('office', '')
            try:
                logger.info("[verified][employee_view] office_raw=%r user=%r", office, user_data.get('username'))
            except Exception:
                pass
            textnow_collection = get_collection_by_office(mongo, office, 'emails')
            if not office:
                return HttpResponse('Unable to determine your office.', status=400)
            if textnow_collection is None:
                try:
                    logger.error("[verified][employee_view] unsupported_office office=%r user=%r", office, user_data.get('username'))
                except Exception:
                    pass
                return HttpResponse(f'Unsupported office: {office}', status=400)

            # Lấy dữ liệu TextNow accounts với các tham số tìm kiếm (khởi tạo giao diện)
            search_date = request.GET.get('date')
            status_tn = request.GET.get('status_tn')
            created_by = request.GET.get('created_by')
            
            # Lấy danh sách người tạo
            creators = list(textnow_collection.distinct('created_by'))
            creators = sorted([creator for creator in creators if creator])

            # Xây dựng query
            query = {}
            if search_date:
                start_date = safe_parse_date_only(search_date)
                if start_date:
                    end_date = start_date.replace(hour=23, minute=59, second=59)
                    query['created_at'] = {'$gte': start_date, '$lte': end_date}

            if status_tn:
                query['status_account_TN'] = status_tn

            if created_by:
                query['created_by'] = created_by

            # Dữ liệu sẽ được load qua API, chỉ cần truyền danh sách office cho dropdown
            return render(request, 'authentication/verified.html', {
                'textnow_accounts': [],
            })

    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)

@csrf_exempt
def search_textnow_api(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to database'
                }, status=500)
            
            db = mongo.db
            # Lấy session data từ request
            user_data = request._session_data

            # Lấy parameters từ request
            status_account_TN = request.GET.get('status_account_TN')
            status_account_TF = request.GET.get('status_account_TF')
            # Luôn dùng ngày hôm nay — không nhận date từ client
            search_date = get_current_time().strftime('%Y-%m-%d')
            # Tìm kiếm nhân viên theo tên (partial, case-insensitive)
            employee = request.GET.get('employee', '').strip()
            try:
                page_size = int(request.GET.get('page_size', '2000'))
            except Exception:
                page_size = 2000
            page_size = max(10, min(page_size, 2000))

            # Luôn query tất cả các office
            collections = []
            for off in OFFICE_NAMES:
                col = get_collection_by_office(mongo, off, 'emails')
                if col is not None:
                    collections.append(col)

            if not collections:
                return JsonResponse({'success': False, 'error': 'No valid office collections found.'}, status=400)

            # Xây dựng query
            query = {}
            query['created_at'] = {'$regex': f'^{search_date}'}

            if status_account_TN:
                if ',' in status_account_TN:
                    statuses = [s.strip() for s in status_account_TN.split(',') if s.strip()]
                    if statuses:
                        query['status_account_TN'] = {'$in': statuses}
                else:
                    query['status_account_TN'] = status_account_TN

            if status_account_TF:
                if ',' in status_account_TF:
                    statuses = [s.strip() for s in status_account_TF.split(',') if s.strip()]
                    if statuses:
                        query['status_account_TF'] = {'$in': statuses}
                else:
                    query['status_account_TF'] = status_account_TF

            if not status_account_TN and not status_account_TF:
                query['status_account_TN'] = {'$ne': 'new'}

            # Tìm kiếm nhân viên theo created_by (tên username) — partial, case-insensitive
            if employee:
                query['created_by'] = {'$regex': re.escape(employee), '$options': 'i'}

            projection = {
                '_id': 1, 'email': 1, 'password_email': 1, 'pass_TN': 1,
                'full_information': 1, 'status_account_TN': 1,
                'status_account_TF': 1, 'created_at': 1, 'created_by': 1,
            }

            try:
                logger.info("[verified][search_api] employee=%r query=%s", employee, query)
            except Exception:
                pass

            # Query từng collection, merge kết quả
            textnow_accounts = []
            for col in collections:
                cursor = col.find(query, projection).sort('created_at', -1).limit(page_size)
                for account in cursor:
                    account['_id'] = str(account['_id'])
                    textnow_accounts.append(account)

            # Sắp xếp theo created_at giảm dần sau khi merge
            textnow_accounts.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            textnow_accounts = textnow_accounts[:page_size]

            if '_id' in user_data:
                user_data['_id'] = str(user_data['_id'])

            try:
                logger.info("[verified][search_api] result_count=%s", len(textnow_accounts))
            except Exception:
                pass

            return JsonResponse({
                'success': True,
                'data': textnow_accounts,
                'pagination': {
                    'total': len(textnow_accounts),
                    'page': 1,
                    'page_size': page_size,
                    'total_pages': 1,
                }
            })
    except Exception as e:
        logger.error(f"Error in search_textnow_api: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@api_view(['POST'])
@parser_classes([JSONParser])
def get_reserve_mails(request):
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to database'
                }, status=500)
            
            db = mongo.db
            
            data = request.data
            office = data.get('office')      # Lấy office từ request
            quantity = data.get('quantity')

            # Kiểm tra số lượng email có status "chưa sử dụng" trong collection long_term
            long_term_name = get_long_term_collection_name(office)
            if not long_term_name:
                return JsonResponse({'success': False, 'error': f'Unsupported office: {office}'}, status=400)
            long_term_collection = db[long_term_name]
            
            available_count = long_term_collection.count_documents({
                'status': 'chưa sử dụng'
            })
            
            # Kiểm tra nếu số lượng yêu cầu lớn hơn số lượng có sẵn
            if quantity > available_count:
                return JsonResponse({
                    'success': False,
                    'error': f'Requested quantity ({quantity}) exceeds available count ({available_count})'
                }, status=400)
            
            # Lấy email từ collection long_term với status "chưa sử dụng"
            emails = list(long_term_collection.find(
                {'status': 'chưa sử dụng'}
            ).limit(quantity))

            if len(emails) == 0:
                return JsonResponse({
                    'success': False,
                    'error': 'No available emails found'
                }, status=400)
            
            # Xóa các email đã lấy
            email_ids = [email['_id'] for email in emails]
            long_term_collection.delete_many(
                {'_id': {'$in': email_ids}}
            )

            # Chuẩn bị dữ liệu để insert vào collection office
            emails_to_insert = []
            for email in emails:
                email_copy = email.copy()
                email_copy.pop('_id', None)  # Remove _id field for the new insert
                emails_to_insert.append(email_copy)

            # Nếu có office hợp lệ, lưu thêm vào collection tương ứng
            office_collection = get_collection_by_office(mongo, office, 'emails')
            if office_collection is not None:
                result_office = office_collection.insert_many(emails_to_insert)
                return JsonResponse({
                    'success': True,
                    'office_inserted_ids': [str(_id) for _id in result_office.inserted_ids],
                    'message': f'Saved to {office} collection'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Unsupported office: {office}'
                }, status=400)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@csrf_exempt
@api_view(['POST'])
@parser_classes([JSONParser])
def save_purchased_emails(request):
    try:
        data = request.data
        emails = data.get('emails', [])  # Lấy danh sách emails từ request
        office = data.get('office')      # Lấy office từ request
        import_type = data.get('import_type')

        if not isinstance(emails, list) or len(emails) == 0:
            return JsonResponse({'success': False, 'error': 'Invalid data'})

        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to MongoDB'
                })

            if import_type == 'office':
                # Collections theo office
                office_collection = get_collection_by_office(mongo, office, 'emails')
                if office_collection is None:
                    return JsonResponse({
                        'success': False,
                        'error': 'Unable to access collections'
                    })
                
                # Thêm trường status mặc định nếu chưa có
                for email in emails:
                    if 'status' not in email:
                        email['status'] = 'chưa sử dụng'
                    # Thêm created_at nếu chưa có
                    if 'created_at' not in email:
                        email['created_at'] = get_current_time()
                    # Gắn type_mail nếu thiếu
                    if 'type_mail' not in email:
                        email['type_mail'] = import_type
                    # Thêm created_by nếu chưa có
                    # if 'created_by' not in email:
                    #     email['created_by'] = request.user.username
                
                # Lọc email trùng trước khi insert
                if office_collection is not None:
                    collection = office_collection
                    if collection is None:
                        return JsonResponse({
                            'success': False,
                            'error': f'Unable to access collection {collection}'
                        })
                    # Lấy danh sách email text cần insert
                    emails_to_insert = emails
                    # Lấy danh sách email đã tồn tại trong collection
                    existing_emails = set(collection.distinct('email'))
                    # Lọc ra các email chưa tồn tại
                    filtered_emails = [e for e in emails_to_insert if e.get('email') not in existing_emails]
                    duplicate_emails = [e.get('email') for e in emails_to_insert if e.get('email') in existing_emails]
                    if not filtered_emails:
                        return JsonResponse({
                            'success': False,
                            'error': 'All emails already exist in the system',
                            'duplicate_emails': duplicate_emails
                        })
                    result_office = collection.insert_many(filtered_emails)
                    return JsonResponse({
                        'success': True,
                        'office_inserted_ids': [str(_id) for _id in result_office.inserted_ids],
                        'message': f'Saved to collection {office}. Could not add duplicate email(s) {len(duplicate_emails)}.',
                        'duplicate_emails': duplicate_emails
                    })
                else:
                    return JsonResponse({
                        'success': True,
                        'message': 'Saved to default collection'
                    })
            elif import_type == 'long_term':
                # Lấy collection dựa trên office
                long_term_name = get_long_term_collection_name(office)
                collection = mongo.get_collection(long_term_name) if long_term_name else None
                if collection is None:
                    return render(request, 'authentication/error.html', {
                        'message': f'Unable to access collection {collection}'
                    }, status=500)
                
                # Thêm trường status mặc định nếu chưa có
                for email in emails:
                    if 'status' not in email:
                        email['status'] = 'chưa sử dụng'
                    # Thêm created_at nếu chưa có
                    if 'created_at' not in email:
                        email['created_at'] = get_current_time()
                    # Gắn type_mail nếu thiếu
                    if 'type_mail' not in email:
                        email['type_mail'] = import_type
                    # Thêm created_by nếu chưa có
                    # if 'created_by' not in email:
                    #     email['created_by'] = request.user.username
                    if 'long_term' not in email:
                        email['long_term'] = True
                
                # Lưu vào collection
                result = collection.insert_many(emails)
                return JsonResponse({
                    'success': True,
                    'inserted_ids': [str(_id) for _id in result.inserted_ids],
                    'message': f'Saved to {collection}'
                }, status=200)
            elif import_type == 'buymail':
                # Collections theo office
                office_collection = get_collection_by_office(mongo, office, 'emails')
                if office_collection is None:
                    return render(request, 'authentication/error.html', {
                        'message': 'Unable to access collections'
                    }, status=500)
                
                # Thêm trường status mặc định nếu chưa có
                for email in emails:
                    if 'status' not in email:
                        email['status'] = 'chưa sử dụng'
                    # Thêm created_at nếu chưa có
                    if 'created_at' not in email:
                        email['created_at'] = get_current_time()
                    # Thêm created_by nếu chưa có
                    # if 'created_by' not in email:
                    #     email['created_by'] = request.user.username
                
                # Nếu có office hợp lệ, lưu thêm vào collection tương ứng
                if office_collection is not None:
                    collection = office_collection
                    if collection is None:
                        return render(request, 'authentication/error.html', {
                            'message': f'Unable to access collection {collection}'
                        }, status=500)
                    result_office = collection.insert_many(emails)
                    return JsonResponse({
                        'success': True,
                        'inserted_ids': [str(_id) for _id in result_office.inserted_ids],
                        'message': f'Saved to {collection}'
                    }, status=200)
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'Not supported import type: {import_type}'
                }, status=400)
    except Exception as e:
        return render(request, 'authentication/error.html', {
            'message': str(e)
        }, status=500)


@csrf_exempt
@api_view(['POST'])
@parser_classes([JSONParser])
def save_gmail_recovery_accounts(request):
    try:
        data = request.data
        accounts = data.get('accounts', [])
        office = data.get('office')

        if not isinstance(accounts, list) or len(accounts) == 0:
            return JsonResponse({'success': False, 'error': 'Invalid data'})

        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Unable to connect to MongoDB'
                })

            # Lưu theo office, sử dụng collection suffix 'gmail_recovery'
            collection = get_collection_by_office(mongo, office, 'gmail_recovery')
            if collection is None:
                return JsonResponse({
                    'success': False,
                    'error': f'Unsupported office: {office}'
                }, status=400)

            # Chuẩn hóa trường và thêm mặc định
            prepared = []
            for acc in accounts:
                email = (acc.get('email') or '').strip()
                password_email = (acc.get('password_email') or '').strip()
                gmail_recovery = (acc.get('gmail_recovery') or '').strip()

                if not email or not password_email:
                    continue

                item = {
                    'email': email,
                    'password_email': password_email,
                    'gmail_recovery': gmail_recovery,
                    'status': acc.get('status') or 'chưa sử dụng',
                    'created_at': acc.get('created_at') or get_current_time(),
                    'office': office,
                    'type_mail': 'gmail_recovery',
                }
                # Thêm trường full_infomation (email|password|gmail_recovery?) giữ nguyên khi thiếu recovery
                try:
                    item['full_infomation'] = f"{email}|{password_email}" + (f"|{gmail_recovery}" if gmail_recovery else "")
                except Exception:
                    pass

                prepared.append(item)

            if not prepared:
                return JsonResponse({'success': False, 'error': 'No valid accounts to insert'})

            # Chống trùng theo email
            existing_emails = set(collection.distinct('email'))
            to_insert = [a for a in prepared if a['email'] not in existing_emails]
            duplicate_emails = [a['email'] for a in prepared if a['email'] in existing_emails]

            if not to_insert:
                return JsonResponse({
                    'success': False,
                    'error': 'All accounts already exist in the system',
                    'duplicate_emails': duplicate_emails
                })

            result = collection.insert_many(to_insert)
            return JsonResponse({
                'success': True,
                'inserted_ids': [str(_id) for _id in result.inserted_ids],
                'inserted_count': len(result.inserted_ids),
                'duplicate_emails': duplicate_emails
            })
    except Exception as e:
        logger.error(f"Error in save_gmail_recovery_accounts: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def suggest_employees(request):
    """
    Trả về danh sách gợi ý tên nhân viên (username) khớp với query.
    GET ?q=abc  → tìm username chứa 'abc' (partial, case-insensitive)
    """
    q = request.GET.get('q', '').strip()
    if not q:
        return JsonResponse({'success': True, 'suggestions': []})
    try:
        with MongoDBConnection() as mongo:
            if mongo is None or mongo.db is None:
                return JsonResponse({'success': False, 'error': 'Unable to connect to database'}, status=500)
            users_col = mongo.get_collection('users')
            if users_col is None:
                return JsonResponse({'success': True, 'suggestions': []})
            cursor = users_col.find(
                {'username': {'$regex': re.escape(q), '$options': 'i'}},
                {'username': 1, '_id': 0}
            ).limit(10)
            suggestions = [doc['username'] for doc in cursor if doc.get('username')]
            return JsonResponse({'success': True, 'suggestions': suggestions})
    except Exception as e:
        logger.error(f"Error in suggest_employees: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)