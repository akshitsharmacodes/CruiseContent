from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from accounts.models import AdminProfile

class Command(BaseCommand):
    help = 'Sets up the developer email as a MASTER AdminProfile safely'

    def handle(self, *args, **options):
        email = 'akshitsharmacodes@gmail.com'
        User = get_user_model()
        
        user = User.objects.filter(email=email).first()
        if not user:
            self.stdout.write(self.style.ERROR(f"User {email} does not exist in the database."))
            return
            
        profile, created = AdminProfile.objects.get_or_create(
            user=user,
            defaults={'admin_level': 'MASTER', 'is_active': True}
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created new MASTER AdminProfile for {email}."))
        else:
            if profile.admin_level != 'MASTER':
                profile.admin_level = 'MASTER'
                profile.is_active = True
                profile.save()
                self.stdout.write(self.style.SUCCESS(f"Updated existing AdminProfile for {email} to MASTER."))
            else:
                self.stdout.write(self.style.SUCCESS(f"AdminProfile for {email} is already MASTER."))
