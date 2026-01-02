# Offers Camp

![Offers Camp logo](https://offers.camp/images/logo-sm.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tampermonkey](https://img.shields.io/badge/UserScript-Tampermonkey-red)](https://www.tampermonkey.net/)

**Offers Camp** is a centralized hub for your credit card merchant offers. It collects data via a browser userscript and syncs it to a web dashboard, allowing you to search, filter, and track offers across multiple banks in one place.

## ✨ Features

- **Unified Dashboard**: View Amex, Chase, and Citi offers side-by-side.
- **Smart Parsing**: Uses advanced state interception to fetch offers instantly without slowing down the page.
- **Flexible Sync Control**: Choose between fully automated syncing or manual control via the on-page widget.
- **Privacy Focused**: Runs locally in your browser; you control where the data is sent.

---

## 🏦 Supported Banks

- ✅ American Express
- ✅ Chase
- ✅ Citi
- ➕ More coming soon

Each bank is implemented as an independent provider so new banks can be added without touching the core system.

---

## 🚀 Installation (Userscript)

To start collecting offers, you need the **Offers Camp Collector** script.

1.  Install the **[Tampermonkey](https://www.tampermonkey.net/)** browser extension (Chrome, Firefox, Edge).
2.  Open the local or public installer page: [https://tm.offers.camp/](https://tm.offers.camp/)
3.  Click **"Install Offers Camp Collector"** and confirm the installation in Tampermonkey.
4.  Visit your bank's offer page (e.g., Amex Offers) to trigger the sync.

Once installed, the collector automatically runs on supported bank portals.

---

## 📝 How It Works

1. The Tampermonkey script detects supported bank offer pages.
2. Offers are extracted via official APIs.
3. All offers are normalized into a common schema.
4. Data is sent securely to the backend.
5. The frontend queries the backend so you can:
    - search across all cards
    - filter by bank or card
    - view offers on mobile or desktop

## Sending Modes & Configuration

Offers Camp supports both automatic and manual sending, configurable per user to suit your workflow.

### 🔄 Auto Send

When **Auto send** is enabled:

* **Automatic Triggers**: Offers are automatically sent to the backend after:
    * Page refresh
    * Card switch
    * Offer list reload
* **Zero Friction**: No user interaction is required.
* **Best For**: Users who want Offers Camp to *"just work in the background"* and ideally quickly sync all cards without thinking about it.

### 👆 Manual Send

Manual controls are always available via the on-page popup widget.

#### **Send now**
* Sends offers collected from the **current card only**.

#### **Send all**
* Sends **all collected offers** across all cards displayed on the site.

**This is useful when:**
* You want full control over when data is transmitted.
* You are testing or debugging the collector.
* You prefer batching uploads rather than real-time syncing.

---

### 🎛 Providers & Controls

From the Offers Camp settings panel, you can fully customize the collector's behavior:

#### Provider Management
* **Individual Toggle**: Enable or disable specific providers:
    * Amex
    * Chase
    * Citi

#### Backend Connection
* **Local Backend**: Use this if you are self-hosting the platform for privacy purpose.
* **Cloud Backend** (Default): Syncs to the public Offers Camp web dashboard.

> **Note**: Provider settings are stored locally in Tampermonkey and are applied consistently across all supported banks.

## 🛠 Self-Hosting/Local Development.

This repository is a monorepo containing the API server, the React frontend, and the Userscript source.

### Prerequisites

- Node.js (v20.0+)
- Mysql v8.0+

### Backend

```bash
cd backend
# Copy env example
cp .env.example .env
# Install dependencies
npm install
# Start dev server
npm run dev
```

The API runs on `http://localhost:4000`.

### Frontend

The frontend provides the dashboard and serves the userscript installer page.

```bash
cd frontend
# Install dependencies
npm install
# Start dev server
npm run dev
```

The UI runs on `http://localhost:5173`.

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

## ⚠️ Disclaimer

Offers Camp is an open-source tool and is not affiliated with, endorsed by, or associated with American Express, Chase, Citi, or any other financial institution. Use responsibly and in accordance with your bank's terms of service.
