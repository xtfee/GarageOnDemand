import os
import django
import random
import requests
import time
from django.core.files.base import ContentFile
from decimal import Decimal
from datetime import timedelta, datetime
from django.db import connection
from django.utils import timezone

# Django config - set settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from garages.models import Garage, Equipment, Reservation, SystemConfig
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp

# --- IMAGE CONFIG ---
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# Skrócona lista 10 zdjęć warsztatów
WORKSHOP_URLS = [
    "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1625047509168-a7026f36de04?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1504222490345-c075b6008014?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1597760428821-6d43058932bb?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1552996923-bf984e991663?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1632823471565-1ecf98924959?auto=format&fit=crop&w=800&q=80"
]

def run_seed():
    print(">>> START SEEDER: Generating Intelligent Data <<<")

    User = get_user_model()

    # 1. CLEANUP - removing old data
    print("[1/6] Cleaning database...")
    Reservation.objects.all().delete()
    Garage.objects.all().delete()
    Equipment.objects.all().delete()
    # Remove all users except superusers
    User.objects.exclude(is_superuser=True).delete()
    SystemConfig.objects.all().delete()

    # Enable unaccent extension in Postgres
    with connection.cursor() as cursor:
        try: 
            cursor.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")
        except Exception: 
            pass

    # 2. SYSTEM CONFIGURATION
    SystemConfig.objects.create(
        refund_limit_hours=24, 
        base_hour_price=50, 
        base_day_price=350,
        max_active_reservations=5, 
        max_reservation_days=7
    )

    # 3. USERS
    if not User.objects.filter(username='admin').exists():
        admin = User.objects.create_superuser('admin', 'admin@garaz.pl', 'admin', phone_number='+48111222333')
        admin.role = 'admin'
        admin.email_verified = True
        admin.save()
        print("[+] Admin created (login: admin / password: admin)")
    
    clients = []
    print("[+] Generating clients...")
    for i in range(1, 11):
        try:
            u = User.objects.create_user(f'client{i}', f'client{i}@test.pl', 'password123', phone_number=f'+48{random.randint(600000000, 999999999)}')
            u.role = 'client'
            u.email_verified = True
            u.save()
            clients.append(u)
        except Exception:
            pass # Ignore if already exists
    
    if not clients:
        clients = list(User.objects.filter(role='client'))

    # 4. EQUIPMENT
    print("[+] Generating equipment...")
    eq_list = [
        {"name": "Two-post Lift", "icon": "⏫", "pro": True},
        {"name": "Service Pit", "icon": "🕳️", "pro": True},
        {"name": "Engine Hoist", "icon": "🏗️", "pro": True},
        {"name": "MIG/MAG Welder", "icon": "⚡", "pro": True},
        {"name": "YATO Wrench Set", "icon": "🔧", "pro": False},
        {"name": "Impact Wrench", "icon": "🔩", "pro": False},
        {"name": "50L Compressor", "icon": "💨", "pro": False},
        {"name": "Industrial Vacuum", "icon": "🧹", "pro": False},
        {"name": "Pressure Washer", "icon": "💦", "pro": False},
        {"name": "OBD2 Diagnostic Computer", "icon": "💻", "pro": False},
    ]
    
    db_eq = {}
    for item in eq_list:
        obj = Equipment.objects.create(name=item['name'], icon=item['icon'], description="Professional equipment included in rental price.")
        db_eq[item['name']] = obj

    # PRE-DOWNLOAD IMAGES TO AVOID RATE LIMITS
    print(f"[+] Pobieranie {len(WORKSHOP_URLS)} bazowych zdjec zeby oszukac rate-limity Unsplash...")
    downloaded_images = []
    for i, url in enumerate(WORKSHOP_URLS):
        print(f"   -> Pobieranie bazy {i+1}/{len(WORKSHOP_URLS)}...")
        try:
            res = requests.get(url, headers=HEADERS, timeout=10)
            if res.status_code == 200:
                downloaded_images.append(res.content)
            time.sleep(1) # małe opóźnienie dla bezpieczeństwa
        except Exception as e:
            print(f"      [!] Błąd pobierania: {e}")

    # 5. GARAGES (20 units)
    print("[+] Generating 20 garages...")
    cities = ["Warsaw", "Krakow", "Wroclaw", "Poznan", "Gdansk"]
    
    garages = []
    for i in range(20):
        is_pro = i < 8 
        
        name = f"{'Center' if is_pro else 'Garage'} {'Mechanic' if is_pro else 'Hobby'} #{i+1}"
        price_h = Decimal(random.randint(80, 150) if is_pro else random.randint(30, 60))
        
        g = Garage.objects.create(
            name=name,
            address=f"{i+1} Test Street, {random.choice(cities)}",
            description="Professional workshop with full equipment." if is_pro else "Small garage for quick repairs and DIY work.",
            price_per_hour=price_h,
            price_per_day=price_h * 8,
            width=5.0, length=7.0, height=3.0,
            is_active=True
        )
        
        if is_pro:
            g.equipment.add(db_eq["Two-post Lift"], db_eq["Engine Hoist"], db_eq["MIG/MAG Welder"], db_eq["YATO Wrench Set"])
        else:
            g.equipment.add(db_eq["YATO Wrench Set"], db_eq["Industrial Vacuum"])
            if random.random() > 0.5: g.equipment.add(db_eq["50L Compressor"])

        # Przypisanie pre-pobranych zdjęć (modulo zapętla index)
        if downloaded_images:
            img_content = downloaded_images[i % len(downloaded_images)]
            # Zapisujemy ContentFile bezpośrednio z pamięci - to jest błyskawiczne i nie robi strzałów po sieci
            g.image.save(f"garage_view_{i+1}.jpg", ContentFile(img_content))
            print(f"   -> Przypisano zdjecie do {name}")
        else:
            print(f"   -> Ominieto zdjecie dla {name} (brak pobranych bazowych)")
            
        g.save()
        garages.append(g)

    # 6. RESERVATIONS (GENERATING ML PATTERNS)
    print("[+] Generating reservation history (last 90 days)...")
    now = timezone.now()
    start_date = now - timedelta(days=90)
    total_res = 0

    curr = start_date
    while curr < now + timedelta(days=7):
        is_weekend = curr.weekday() >= 5
        day_volume = random.randint(6, 12) if is_weekend else random.randint(2, 6)
        
        for _ in range(day_volume):
            garage = random.choice(garages)
            user = random.choice(clients)
            
            has_lift = garage.equipment.filter(name="Two-post Lift").exists()
            
            if has_lift:
                duration = random.randint(5, 10) if random.random() > 0.2 else random.randint(1, 3)
            else:
                duration = random.randint(1, 3) if random.random() > 0.2 else random.randint(4, 6)
            
            start_hour = random.randint(7, 20 - duration) if (20 - duration) > 7 else 7
            
            start_dt = curr.replace(hour=start_hour, minute=0, second=0, microsecond=0)
            if timezone.is_naive(start_dt):
                start_dt = timezone.make_aware(start_dt)
                
            end_dt = start_dt + timedelta(hours=duration)
            
            if end_dt < now:
                status = 'cancelled' if random.random() < 0.15 else 'completed'
            else:
                status = 'confirmed'

            Reservation.objects.create(
                garage=garage,
                user=user,
                start_time=start_dt,
                end_time=end_dt,
                total_price=Decimal(duration) * garage.price_per_hour,
                status=status,
                access_code="SEED123",
                is_historical=(end_dt < now)
            )
            total_res += 1
        
        curr += timedelta(days=1)

    print(f"--- SEED FINISHED: Created {total_res} reservations ---")

    # 7. GOOGLE LOGIN CONFIGURATION AUTOMATION
    print("[+] Configuring Google Social App Integration...")
    site, _ = Site.objects.get_or_create(id=1)
    site.domain = '127.0.0.1:8000' 
    site.name = 'Garage App'
    site.save()

    google_client_id = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '')
    google_secret = os.environ.get('GOOGLE_OAUTH_SECRET', '')

    if not google_client_id or not google_secret:
        print("   -> [SKIP] GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_SECRET not set in .env.local.")
        print("            Google login won't be functional until you add them.")
    else:
        google_app, _ = SocialApp.objects.update_or_create(
            provider='google',
            defaults={
                'name': 'Google Login',
                'client_id': google_client_id,
                'secret': google_secret,
            },
        )
        google_app.sites.add(site)
        print("   -> [SUCCESS] Google Social App configured and linked to site.")

if __name__ == '__main__':
    run_seed()