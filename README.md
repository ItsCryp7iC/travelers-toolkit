# 🗡️ Traveler's Toolkit

Traveler's Toolkit is a comprehensive, interactive progression planner and inventory manager built specifically for Genshin Impact players. It goes beyond simple checklists by offering real-time math engines, cloud synchronization, and authentic in-game inventory sorting logic.

**Live app:** 

**Tech stack:** React, Vite, TanStack Table, Google Auth + Drive API

---

## 🌟 Key Features

### 🗂️ Roster & Armory Management
- **High-Density Data Tables:** Built on TanStack Table for sorting, multi-select filtering, and rapid bulk review.
- **Inline Progression Editing:** Tweak current and target levels, talent nodes, and ascension phases directly within the roster view.
- **Intelligent Ascension Tracking:** Dynamic milestone indicators and conditional toggles that accurately reflect in-game progression.
- **Relational Loadouts:** Assign weapons directly to characters with bidirectional state synchronization.
- **Granular Requirements Breakdown:** Expanding columns list individual material tiers, splitting Ascension Gems into Slivers, Fragments, Chunks, and Gemstones.
- **Batch Operations:** Populate your roster with "Add All," or manage entire sets of characters and weapons through bulk edit modals.

### 🧮 Advanced Math & Calculation Engine
- **Precision Cost Generation:** A custom relational math engine determines the exact Mora, EXP, and materials required for any target state.
- **Passive & Event Support:** Auto-applies character passive talent Mora discounts for weapons, plus a toggle for 1.5x Event EXP bonuses.
- **Intelligent Ore Distribution:** Calculates the exact distribution of Mystic, Fine, and Enhancement Ores.
- **Dynamic Grand Totals:** Live-updating footer rows give a consolidated view of required materials across your entire active roster.
- **Traveler Exception Handling:** Natively calculates and aggregates the Traveler's unique 3-book rotating talent requirement.

### 🗺️ Daily Action Plan & Reminders
- **Interactive Domain Cards:** Collapsible cards group farming routes by Region, Domain, and Weekly Boss.
- **Geographical & Chronological Sorting:** Action plans sorted by release order and map region.
- **"To Farm" Metrics:** Compares current inventory against your roster's total requirements to show exactly what's still needed.
- **Tailored UI Cards:** Distinct sections for Local Specialties, Normal Bosses, and Talent/Weapon Domains.

### 🎒 Authentic Inventory System
- **In-Game Sorting Logic:** Materials sorted with a custom index mapping to match their appearance order in the official client.
- **Rich UI Elements:** Dynamic rarity background gradients, CDN-sourced game assets, and a 3-column grid layout with nested navigation tabs.

### 🔄 Data Sync & Backup
- **GOOD Format Support:** Compatible with the Genshin Open Object Description (GOOD) format, with an interactive import review modal for conflict resolution.
- **Cloud Sync:** Google Authentication, rolling Google Drive backups, and automatic global state synchronization.
- **Live Server Data:** Optional HoYoLAB cookie input enables live auto-syncing of resin widgets and in-game statistics.

### 🎨 Visual Identity
- **Immersive Theming:** Midnight Blue "Starry Night" aesthetic with glassmorphism UI elements and the official Genshin Impact font.
- **Asset-Rich Interfaces:** Custom SVG icons, CDN material images, and rarity color-coding across text and components.
- **Custom Interactive Elements:** Rich dropdowns, directional swipe-navigation modals, and dynamic tooltips.

### 🛠️ Developer Tooling
- **Database Builder:** Built-in Dev Mode for JSON data maintenance with dynamic material comboboxes.
- **Background Staging:** Stage unsaved local storage changes with one-click clear and raw Node script export.

---

## 🚀 Local Development Setup

Requires Node.js and Python 3.x.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ItsCryp7iC/travelers-toolkit.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd travelers-toolkit
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

### Backend Setup (Python Sync Server)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # Linux/Mac
   source .venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Run the server:**
   ```bash
   python -m uvicorn main:app --reload
   ```

---

## 🤖 Acknowledgments

This project was built with significant assistance from **Google Gemini**, used throughout development for architecture decisions, debugging, and code generation, as well as for drafting project documentation.

## 📄 License

The source code in this repository is licensed under the [MIT License](LICENSE).

This license covers the application code only. Genshin Impact character data, icons, fonts, and other game assets referenced or displayed by this app are the property of COGNOSPHERE PTE. LTD. / HoYoverse and are used under fan-content norms for a non-commercial, unofficial fan tool — they are not covered by this repository's license and are not redistributed as original work.

*Genshin Impact and all related game assets are trademarks and copyrights of COGNOSPHERE PTE. LTD.*
