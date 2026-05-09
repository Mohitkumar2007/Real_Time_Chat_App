# ByteTalk Backend

Django REST API backed by MongoDB through PyMongo.

It supports username-based private chat, read receipts, image/GIF messages, reply metadata, typing status, profile updates, and TOTP authentication.

## Setup

From the project root:

```bat
setup.bat
```

Git Bash:

```bash
bash setup.sh
```

macOS:

```bash
bash setup.macos.sh
```

This creates `backend\.env` if missing, creates or reuses `backend\Pro_venv`, and installs `backend\requirements.txt`.

When `backend\.env` does not exist, setup asks for `MONGO_URI`. Press Enter to use `mongodb://localhost:27017/`.

## Run

From the project root:

```bat
run.bat
```

Git Bash:

```bash
bash run.sh
```

macOS:

```bash
bash run.macos.sh
```

Manual backend command:

```bat
cd backend
Pro_venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

## MongoDB

MongoDB must be running and reachable through `backend\.env`.

Do not commit `backend\.env`, `backend\Pro_venv`, or local database files. The root `.gitignore` excludes them.

Default database:

```env
MONGO_DB_NAME=chatapp_db
```

## Auth

Accounts require:

- username
- strong password
- TOTP secret setup
- 6-digit TOTP code during registration and login

## Chat Data

MongoDB stores users, contacts, messages, and typing status. Messages may include:

- text
- optional image/GIF attachment data URL
- optional reply reference and reply preview
- sender, recipient, status, and timestamp

## Endpoints

- `GET /api/health/`
- `POST /api/chat/auth/totp/setup/`
- `POST /api/chat/auth/register/`
- `POST /api/chat/auth/login/`
- `PATCH /api/chat/auth/profile/`
- `POST /api/chat/auth/password/`
- `GET /api/chat/contacts/`
- `POST /api/chat/contacts/`
- `GET /api/chat/contacts/<username>/messages/`
- `POST /api/chat/contacts/<username>/messages/`
- `GET /api/chat/contacts/<username>/typing/`
- `POST /api/chat/contacts/<username>/typing/`
