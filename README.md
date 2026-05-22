# 🚗 Garage on Demand

**A comprehensive system for reserving workshop spaces like "Airbnb for mechanics".**

The application allows hobbyists and mechanics to rent fully equipped garages by the hour or day, while providing administrators with powerful tools for business management and advanced data analysis (Business Intelligence & ML).

---

## 🌟 Main Features

### 👤 For the User (Client)
* **Browsing Offers:** A clear list of garages with **real photos** (automatically downloaded from Unsplash during installation) and prices (hourly/daily).
* **Search and Filtering:** Search by location, price, and specific equipment (e.g., "Lift", "Impact Wrench") with dynamic icons (🔧, ⚡, 🏗️).
* **Reservation System:**
    * Intuitive calendar with "Drag & Drop" mechanism.
    * Real-time availability validation (solved the "zero hour/midnight" problem).
    * Blocking reservations longer than the limit set by the administrator.
* **Online Payments:** Full integration with **Stripe**. Reservation waits 15 minutes for payment, then expires.
* **Client Panel:**
    * Reservation history with statuses (Pending, Confirmed, Canceled).
    * **Access Codes:** Generating a unique PIN for the gate after payment.
    * Possibility of emergency cancellation (with automatic refund if >24h).

### 🛡️ For the Administrator
* **Management Panel:** Full control over the garage database, pricing, equipment, and users.
* **Availability Calendar:** Quick view of any garage's occupancy in monthly view (with color-coded occupancy: free/partial/full).
* **Analytical Dashboard (BI & ML):**
    * **Charts:** Visualization of revenues over time and popularity ranking.
    * **Heat Map:** Precise analysis of workshop occupancy divided by days of the week and hours (0-24).
    * **Association Rules (ML):** Using the **Apriori** algorithm to detect hidden patterns (e.g., "If the garage has a lift, then reservation lasts >4h in 80%").
    * **Decision Tree (ML):** Real-time generated visualization (Matplotlib), showing what influences the success or cancellation of reservations (Churn Prediction).
* **Simulation Mode (Sandbox):**
    * Ability to upload an external CSV file to analytical modules.
    * System processes data in RAM ("virtual CSV"), without overwriting the database.
    * Unified logic: ML algorithms work identically for database and file data.

---

## 🛠️ Technology Stack

**Backend:**
* 🐍 **Python 3** + **Django**
* 🔌 **Django REST Framework (DRF)** - API
* 💳 **Stripe** - Payment handling
* 📊 **Data Science:**
    * **Pandas** - Data frame processing.
    * **Mlxtend** - Association algorithms (Apriori).
    * **Scikit-learn** - Decision trees.
    * **Matplotlib** - Tree visualization generation.

**Frontend:**
* 💚 **Vue.js 3** (Composition API) + **Vite**
* 🎨 **Tailwind CSS** + **DaisyUI** - Modern UI.
* 📈 **Chart.js** - Interactive charts.
* 📅 **Interaction:** Custom calendars and Drag&Drop mechanisms.

---

## 🚀 Installation and Launch (Windows)

The project has a script `install-and-run.bat`, which performs a **Full Reset** – cleans the environment, migrations, and sets up the system from scratch.

### Requirements
* Python (added to PATH)
* Node.js
* PostgreSQL (running locally)

### Quick Start

1. **Configure secrets** — copy `.env.example` to `.env.local` and fill in your own values
   (PostgreSQL password, Stripe test keys, Gmail app password, Google OAuth credentials).
   `.env.local` is gitignored and never committed.

2. Run the file in the main folder:
   `install-and-run.bat`

3. **What will the script do?**
   * Creates a virtual environment `venv` and installs libraries (Django, Pandas, Scikit-learn...).
   * **Clears old migrations** and creates a new database.
   * Runs the advanced **Seeder (`seed.py`)**:
     * Creates Admin and 10 clients.
     * Generates 20 garages (different types: PRO / Hobby).
     * Downloads photos from the internet.
     * **Generates 90 days of reservation history (~1500 entries)** with "artificial intelligence" (introduces patterns that the ML module then detects, e.g., higher occupancy on weekends, longer times for expensive workshops).
   * Installs Frontend packages.
   * Launches servers (localhost:5173).

---

## ✅ Testing (Unit Tests)

To ensure that business logic (fee calculation, ML algorithms, user permissions) works correctly, an automated testing script has been prepared.

1. Run the file:
   `testowanie.bat`

2. **What will the script do?**
   * Automatically detects and activates the virtual environment.
   * Runs test suites for the **Accounts** module (registration, login, tokens).
   * Runs test suites for the **Garages** module (reservation logic, time conflicts, ML validation).
   * Displays a color-coded final report (Green = OK, Red = Errors).

---

## 🔑 Login Data (Test)

The database is automatically populated with users:

| Role | Login | Password | Description |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin` | Full access to panel, configuration, and ML. |
| **Clients** | `client1` to `client10` | `password123` | Accounts with reservation history. |

---

## 🧪 Analytical Features (How to test?)

To see the ML modules:
1. Log in as **Admin**.
2. Go to the **Analytics** tab -> **ML Analysis**.
3. Click **"Generate from Database"**. The system will analyze 1500+ generated reservations and show rules like: *When the garage has: Column Lift, there is 80% chance of: Reservation above 4h*.
4. Go to the **Decision Tree** section and generate a chart to visually see how the system classifies the chances of reservation success.
5. You can also download data to CSV ("Export") and upload it again in "Simulate from file" mode to check the Sandbox operation.

---

## 📂 Project Structure

* `garages/views.py` - Core logic: API endpoints, ML algorithms, Stripe integration.
* `seed.py` - Test data generator (Intelligent Seeder).
* `frontend/src/views/AnalyticsPanel.vue` - Analytical dashboard.
* `frontend/src/views/AdminDashboard.vue` - Management panel and calendar.
* `install-and-run.bat` - Installation script (Windows).
* `testowanie.bat` - Script running unit tests.

---

*Note: Environment variables and keys included in the repository are for demonstration/testing purposes only.*