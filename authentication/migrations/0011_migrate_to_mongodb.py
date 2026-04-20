from django.db import migrations
from authentication.mongodb import MongoDBConnection
import logging

logger = logging.getLogger(__name__)

def migrate_to_mongodb(apps, schema_editor):
    try:
        # Lấy các model từ Django
        User = apps.get_model('authentication', 'User')
        UserActivity = apps.get_model('authentication', 'UserActivity')
        EmployeeTextNow = apps.get_model('authentication', 'EmployeeTextNow')
        
        # Migrate Users
        users = User.objects.all()
        with MongoDBConnection() as mongo:
            users_collection = mongo.get_collection('users')
            for user in users:
                user_data = {
                    '_id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'password': user.password,
                    'is_active': user.is_active,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                    'date_joined': user.date_joined,
                    'last_login': user.last_login,
                    'role': user.role,
                    'created_at': user.created_at,
                    'updated_at': user.updated_at
                }
                users_collection.update_one(
                    {'_id': str(user.id)},
                    {'$set': user_data},
                    upsert=True
                )
                logger.info(f"Migrated user: {user.username}")
        
        # Migrate UserActivity
        activities = UserActivity.objects.all()
        with MongoDBConnection() as mongo:
            activities_collection = mongo.get_collection('user_activities')
            for activity in activities:
                activity_data = {
                    '_id': str(activity.id),
                    'user_id': str(activity.user.id),
                    'login_time': activity.login_time,
                    'logout_time': activity.logout_time,
                    'ip_address': str(activity.ip_address),
                    'session_id': activity.session_id,
                    'user_agent': activity.user_agent,
                    'is_active': activity.is_active,
                    'created_at': activity.created_at,
                    'updated_at': activity.updated_at,
                    'role': activity.role
                }
                activities_collection.update_one(
                    {'_id': str(activity.id)},
                    {'$set': activity_data},
                    upsert=True
                )
                logger.info(f"Migrated activity for user: {activity.user.username}")
        
        # Migrate EmployeeTextNow
        employees = EmployeeTextNow.objects.all()
        with MongoDBConnection() as mongo:
            employees_collection = mongo.get_collection('employee_textnow')
            for employee in employees:
                employee_data = {
                    '_id': str(employee.id),
                    'email': employee.email,
                    'password_email': employee.password_email,
                    'password': employee.password,
                    'password_TF': employee.password_TF,
                    'supplier': employee.supplier,
                    'status_account_TN': employee.status_account_TN,
                    'status_account_TF': employee.status_account_TF,
                    'refresh_token': employee.refresh_token,
                    'client_id': employee.client_id,
                    'full_information': employee.full_information,
                    'created_by': employee.created_by,
                    'created_at': employee.created_at,
                    'updated_at': employee.updated_at,
                    'sold_status_TN': employee.sold_status_TN,
                    'sold_status_TF': employee.sold_status_TF
                }
                employees_collection.update_one(
                    {'_id': str(employee.id)},
                    {'$set': employee_data},
                    upsert=True
                )
                logger.info(f"Migrated employee: {employee.email}")
            
        logger.info("Migration to MongoDB completed successfully")
        
    except Exception as e:
        logger.error(f"Error during migration to MongoDB: {str(e)}")
        raise

def reverse_migrate(apps, schema_editor):
    # Implement reverse migration if needed
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('authentication', '0009_employeetextnow_client_id_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_to_mongodb, reverse_migrate),
    ]