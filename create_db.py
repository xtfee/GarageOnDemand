import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load secrets from .env.local (gitignored) or .env (fallback)
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env.local')
load_dotenv(BASE_DIR / '.env')

# Read configuration from environment (matches settings.py)
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
DB_HOST = os.environ.get('DB_HOST', '127.0.0.1')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'garaz_db')


def create_database():
    print(f"[DATABASE] Connecting to PostgreSQL as '{DB_USER}'...")
    try:
        con = psycopg2.connect(dbname='postgres', user=DB_USER, host=DB_HOST, port=DB_PORT, password=DB_PASSWORD)
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()

        # Close other connections so DROP DATABASE can succeed
        cur.execute(
            "SELECT pg_terminate_backend(pg_stat_activity.pid) "
            "FROM pg_stat_activity "
            "WHERE pg_stat_activity.datname = %s AND pid <> pg_backend_pid();",
            (DB_NAME,)
        )

        cur.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (DB_NAME,))
        if cur.fetchone():
            print(f"[DATABASE] Database '{DB_NAME}' already exists. Dropping it...")
            cur.execute(f'DROP DATABASE "{DB_NAME}"')

        print(f"[DATABASE] Creating a new clean database '{DB_NAME}'...")
        cur.execute(f'CREATE DATABASE "{DB_NAME}"')
        print(f"[DATABASE] Success! Database '{DB_NAME}' created.")

        cur.close()
        con.close()
    except Exception as e:
        print("\n[CRITICAL ERROR] Failed to connect to PostgreSQL!")
        print(f"Error: {e}")
        print("Make sure PostgreSQL is running and DB_PASSWORD in .env.local is correct.")
        sys.exit(1)


if __name__ == "__main__":
    create_database()
