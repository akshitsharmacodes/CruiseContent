# CruiseContent 🚢

CruiseContent is the ultimate AI-powered social media automation suite. Built by creators, for creators, it provides a centralized dashboard to generate and schedule intelligent social media content natively utilizing specialized AI models.

## 🏗 System Architecture (HLD)

The platform is designed with a decoupled architecture leveraging background task processing for heavy AI workloads.

```mermaid
graph TD
    %% Define Styles
    classDef frontend fill:#61DAFB,stroke:#333,stroke-width:2px,color:black;
    classDef backend fill:#092E20,stroke:#333,stroke-width:2px,color:white;
    classDef async fill:#FF9900,stroke:#333,stroke-width:2px,color:black;
    classDef ai fill:#9C27B0,stroke:#333,stroke-width:2px,color:white;
    classDef db fill:#336791,stroke:#333,stroke-width:2px,color:white;

    subgraph "Frontend Client (React/Vite)"
        UI["React UI (Shadcn)"]:::frontend
        State["React Context/Hooks"]:::frontend
    end

    subgraph "Django Backend Core"
        API["Django REST API"]:::backend
        DB["SQLite Database"]:::db
    end

    subgraph "Asynchronous Workers"
        Broker["Redis Message Broker"]:::async
        Worker["Celery Worker"]:::async
    end

    subgraph "AI & External APIs"
        Social["Social APIs (X, Facebook)"]:::ai
        LLM["AI Models (Gemini)"]:::ai
    end

    %% Data Flow
    UI <-->|HTTP/JWT| API
    API <-->|CRUD Operations| DB
    
    API -.->|Enqueue Tasks| Broker
    Broker -.->|Consume Tasks| Worker
    Worker <-->|Publish/Fetch| Social
    Worker <-->|Generate Content| LLM
    Worker -->|Update Status| DB
```

## 🧩 Low-Level Design (LLD)

Our Django backend is split into multiple highly decoupled applications. Authentication is handled via Custom JWTs stored in memory and HttpOnly cookies, completely bypassing default Session CSRF vulnerabilities.

```mermaid
graph LR
    %% Define Styles
    classDef app fill:#092E20,stroke:#333,stroke-width:2px,color:white;
    classDef worker fill:#FF9900,stroke:#333,stroke-width:2px,color:black;

    subgraph "Django Applications"
        Auth["accounts (JWT Auth)"]:::app -->|Validates| WS["workspaces (Multi-Tenant)"]:::app
        WS -->|Scopes Data| DA["dashboard_api"]:::app
        DA -->|Trigger Gen| ING["ingestion"]:::app
        ING -->|Orchestrate| LG["langgraph_orchestrator"]:::app
        LG -->|Format/Post| PR["platform_routing"]:::app
    end
    
    LG -.->|Task Queue| CeleryWorker["Celery Tasks"]:::worker
    CeleryWorker -.->|Process Content| API["External APIs"]:::worker
```

## 🗄️ Entity Relationship Diagram (ERD)

Our database is built for a Multi-Workspace architecture where a single User profile can own and switch between multiple workspaces.

```mermaid
erDiagram
    USER }o--o{ WORKSPACE : "belongs to"
    USER ||--o| WORKSPACE : "current_workspace"
    USER ||--o| BUSINESS_PROFILE : "has"
    WORKSPACE ||--o{ PLATFORM_ACCOUNT : "contains"
    WORKSPACE ||--o{ CONTENT_SOURCE : "tracks"
    CONTENT_SOURCE ||--o{ GENERATION_TASK : "triggers"
    GENERATION_TASK ||--o{ GENERATED_POST : "creates"
    GENERATED_POST ||--o{ POST_VARIATION : "has"
    POST_VARIATION ||--o| GENERATED_IMAGE : "features"
    POST_VARIATION ||--o| SOCIAL_POST : "published_as"

    USER {
        int id
        string email
    }
    WORKSPACE {
        int id
        string name
    }
    PLATFORM_ACCOUNT {
        int id
        string platform
        string access_token
    }
    CONTENT_SOURCE {
        int id
        string source_type
    }
    GENERATED_POST {
        int id
        string status
    }
```

---

## 🛠️ Internal Team Onboarding: Local Development Setup

To get this project running locally on your machine, you must strictly follow these steps in order. Ensure you have Docker, Python (3.11+), and Node.js installed.

### 1. Start the Redis Broker
Celery depends on Redis for the task queue. We use Docker to spin up a local instance:
```powershell
# Run from any terminal
docker run -p 6379:6379 redis
```

### 2. Setup the Backend (Django + Celery)
Open a new terminal window, navigate to the `backend/` folder, and setup the Python virtual environment:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Once the environment is active and dependencies are installed, you need to start **two** processes in the backend.

**Terminal 2A (Django Server):**
```powershell
python manage.py migrate
python manage.py runserver
```

**Terminal 2B (Celery Worker):**
Open another terminal, navigate to `backend/`, activate the venv again, and start the Celery worker. *Note: We use `--pool=solo` on Windows to avoid process forking issues.*
```powershell
.\venv\Scripts\activate
python -m celery -A core worker -l info --pool=solo
```

### 3. Setup the Frontend (Vite)
Open a final terminal window, navigate to the `frontend/` directory, install Node modules, and start the development server:
```powershell
cd frontend
npm install
npm run dev
```
The frontend will be available at `http://localhost:5173`.

---

## 🔒 Security & Git Hygiene Standards

- **Environment Variables**: Never hardcode API keys. Place them in `.env` inside `backend/`. 
- **CORS & Auth**: The API relies entirely on custom JWTs (`accounts/authentication.py`). We have explicitly stripped `SessionAuthentication` from DRF to prevent CSRF bugs when passing `credentials: include`.
- **Git Ignore**: `db.sqlite3`, `backend/media/`, `backend/static/`, `frontend/node_modules/`, and `frontend/dist/` are strictly `.gitignore`'d. Do not push databases or large user assets to the repository.

---

## Contributing & Support
If you need help or wish to propose architectural changes to the repository, please reach out to **Akshit Sharma** at **akshitsharmacodes@gmail.com**. Pull Requests must be reviewed by Akshit before merging to the `main` branch.
