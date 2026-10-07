# Recup Management OS

Standalone local management workbench. It reads MongoDB operational collections and never writes to them. Management OS writes are append-only timestamped JSON operation files in `temp_db/operations/`.

## Run
1. Copy `.env.example` to `.env`.
2. Set MongoDB and `MANAGEMENT_PASSWORD`.
3. `npm install`.
4. `npm start`.
5. Open `http://127.0.0.1:4317`.

Keep `HOST=127.0.0.1` for local-only access.

## Principle
The OS knows only its database access and management requirements. It does not call Recup Admin services, analytics, or business logic.
