# HHT Inventory — Position-Template Asset Tracking System

A full-stack asset tracking and workstation inventory application. Built for daily operational use with barcode scanners, manual data entry, and CSV reporting.

## Stack

- **Frontend:** HTML / CSS / JavaScript (single-page app)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Hosting:** EasyPanel (your own server)

## Architecture

### Templates (reusable blueprints)

A template defines the expected components for a type of workstation.

| Template     | Components                          |
|-------------|-------------------------------------|
| Checking    | WKS, ATB, BTP, Monitor, Swiper     |
| Gate        | WKS, Monitor, BGR, DCP             |
| Back Office | WKS, Monitor, DCP                  |

You can create, edit, and delete templates. Templates are independent from positions — changing a template does not affect existing positions until you explicitly reassign it.

### Positions (real workstations)

A position is a physical workstation at a site. When you create a position:
1. Select a site and a template
2. The system copies the template's components into the position as **position components**
3. Each component starts with status **missing**
4. You scan or enter data per component

### Scanning & Editing

Each position component stores:
- component name
- model (from predefined list or custom text)
- serial number
- asset tag
- notes
- status (missing / partial / complete)
- updated timestamp

**Status rules:**
- **Missing** — no serial number and no asset tag
- **Partial** — one of serial/asset present
- **Complete** — both serial and asset present

### Changing a Template (Safe Merge)

When you change the template assigned to a position:
- Matching components (same name) keep their scanned data
- New components from the template are added as missing
- Removed components become **extra** but are **not deleted**
- No data is lost without explicit confirmation

### CSV Export

- Export a single position
- Export all positions (optionally filtered by site or template)
- Generated from the server database, not frontend memory

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Clone & Install

```bash
git clone https://github.com/zikoa1234-ak/hht-inventory.git
cd hht-inventory

# Install backend dependencies
cd backend
npm install
```

### 2. Configure Database

Create a PostgreSQL database:

```bash
createdb hht_inventory
```

Copy the example env file and edit it:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Run the schema and seed data:

```bash
npm run setup
# Or manually:
# psql -d hht_inventory -f schema.sql
# psql -d hht_inventory -f seed.sql
```

### 3. Run

```bash
npm start          # Production
npm run dev        # Development with auto-reload
```

The server serves both the API (port 3001) and the frontend static files.

Open http://localhost:3001 in your browser.

## API Routes

### Sites
| Method | Route            | Description          |
|--------|------------------|----------------------|
| GET    | /api/sites       | List all sites       |
| POST   | /api/sites       | Create a site        |

### Templates
| Method | Route                            | Description                    |
|--------|----------------------------------|--------------------------------|
| GET    | /api/templates                   | List templates (with counts)   |
| GET    | /api/templates/:id               | Get template + components      |
| POST   | /api/templates                   | Create template                |
| PUT    | /api/templates/:id               | Update template name/comp      |
| DELETE | /api/templates/:id               | Delete template                |
| POST   | /api/templates/:id/components    | Add component to template      |

### Positions
| Method | Route                                | Description                       |
|--------|--------------------------------------|-----------------------------------|
| GET    | /api/positions                       | List all positions with summaries |
| POST   | /api/positions                       | Create position from template     |
| GET    | /api/positions/:id                   | Get position + components         |
| PUT    | /api/positions/:id                   | Update position name/site         |
| PATCH  | /api/positions/:id/template          | Safely change assigned template   |
| GET    | /api/positions/:id/components        | Get position components           |
| POST   | /api/positions/:id/components        | Add extra manual component        |
| PUT    | /api/positions/components/:id        | Update a component's data         |
| DELETE | /api/positions/components/:id        | Delete a component                |

### Models
| Method | Route        | Description     |
|--------|-------------|-----------------|
| GET    | /api/models | List models     |
| POST   | /api/models | Add model       |

### Sessions
| Method | Route                 | Description                |
|--------|-----------------------|----------------------------|
| GET    | /api/sessions/:posId  | Get sessions for position  |
| POST   | /api/sessions         | Start/close session        |

### Export
| Method | Route                              | Description                  |
|--------|------------------------------------|------------------------------|
| GET    | /api/export/positions/:id.csv      | Export single position as CSV|
| GET    | /api/export/positions.csv          | Export all positions as CSV  |

## Deployment on EasyPanel

### Step 1: Create the application
1. Log into your EasyPanel dashboard
2. Create a new **Node.js** application
3. Set the project path to your repository

### Step 2: Environment variables
Set these in EasyPanel's environment settings:

```
DATABASE_URL=postgresql://user:password@host:5432/hht_inventory
PORT=3001
NODE_ENV=production
```

### Step 3: Build & Run
EasyPanel will handle:
- `npm install` (auto-detected)
- Running `npm start` to start the server

The server serves both the API and the static frontend files on the same port.

### Step 4: Database
1. Provision a PostgreSQL database in EasyPanel
2. Run the schema and seed scripts against it
3. Set `DATABASE_URL` in your environment

You can run migrations via:
```bash
heroku run npm run setup   # if using Heroku Postgres
# Or via EasyPanel's terminal:
psql "$DATABASE_URL" -f backend/schema.sql
psql "$DATABASE_URL" -f backend/seed.sql
```

## Project Structure

```
hht-inventory/
├── backend/
│   ├── package.json
│   ├── server.js          # Express server entry
│   ├── db.js              # PostgreSQL connection
│   ├── schema.sql         # Database schema
│   ├── seed.sql           # Default seed data
│   ├── .env.example       # Environment template
│   └── routes/
│       ├── sites.js
│       ├── templates.js
│       ├── positions.js
│       ├── models.js
│       ├── sessions.js
│       └── export.js
├── frontend/
│   ├── index.html         # SPA entry
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js         # API service layer
│       ├── state.js       # App state management
│       ├── screens/
│       │   ├── templates.js
│       │   └── positions.js
│       └── app.js         # Main entry & dashboard
├── .gitignore
└── README.md
```

## Migration from Old App

The original app used:
- `sessionData.iata` / `sessionData.model` → replaced by proper **site** and **template** entities
- `scannedItems[]` flat array → replaced by structured **position_components** with individual fields
- Frontend state as source of truth → replaced by **PostgreSQL backend** as source of truth
- Generic scan screen → replaced by **template-based position management** with editable tables

### Key changes:
- Data now persists in PostgreSQL, not browser memory
- Each component has dedicated fields (model, serial, asset tag, notes)
- Templates are reusable blueprints
- Positions are real workstations with full CRUD
- All edits save immediately to the backend
- CSV export reads from the database

## License

MIT