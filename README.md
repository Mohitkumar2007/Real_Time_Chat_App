# ByteTalk

Modern full-stack chat app with TOTP authentication, strong passwords, profile settings, read receipts, image/GIF messaging, WhatsApp-style replies, typing indicators, and a glass-style React interface.

ByteTalk uses a React/Vite frontend and a Django REST backend. Chat data, users, contacts, messages, profile data, and TOTP secrets are stored in MongoDB.

## Features

- Username-based accounts
- Strong password requirement
- TOTP authenticator setup with QR code and copyable secret
- Login with username, password, and 6-digit TOTP code
- Profile settings with display name, password change, and profile photo upload
- Add contacts by username
- User-to-user chat history
- Emoji picker in the message composer
- Image and GIF attachments in chat messages
- Reply to a specific message with an inline quoted preview
- Typing indicator while the other user is composing a message
- Auto-refresh for incoming messages
- Read receipts with single/double ticks
- Modern glass UI with mobile-friendly layout
- Vite proxy support for one ngrok tunnel on port `3000`

## Requirements

- Python 3
- Node.js and npm
- MongoDB running locally or reachable through `backend\.env`

Do not commit local secrets or generated dependencies. The root `.gitignore` excludes `.env`, virtualenvs, `node_modules`, build output, and local SQLite data.

Default MongoDB settings:

```env
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=chatapp_db
```

## Quick Start

Run setup once:

```bat
setup.bat
```

Git Bash alternative:

```bash
bash setup.sh
```

macOS alternative:

```bash
bash setup.macos.sh
```

Start the app:

```bat
run.bat
```

Git Bash alternative:

```bash
bash run.sh
```

macOS alternative:

```bash
bash run.macos.sh
```

`run.bat` opens backend and frontend in separate terminal windows. `run.sh` and `run.macos.sh` keep both processes attached to the same shell and stop them when the shell exits.

## Environment

Backend config lives in `backend\.env`. Start from the example file:

```bat
copy backend\.env.example backend\.env
```

If `backend\.env` does not exist, `setup.bat`, `setup.sh`, and `setup.macos.sh` ask for a MongoDB URI and write it to `MONGO_URI`. Press Enter to use:

```text
mongodb://localhost:27017/
```

On macOS, enter the URI used by your MongoDB install, such as a local Homebrew MongoDB URI or a MongoDB Atlas connection string.

## Local URLs

- Frontend: `http://127.0.0.1:3000/`
- Backend health: `http://127.0.0.1:8000/api/health/`
- Backend through Vite proxy: `http://127.0.0.1:3000/api/health/`

## Account Flow

1. Open the frontend.
2. Click `Create`.
3. Enter a username.
4. Enter a strong password with at least 8 characters, 1 capital letter, 1 digit, and 1 special character.
5. Generate the authenticator key.
6. Scan the QR code or copy the secret into an authenticator app.
7. Enter the current 6-digit TOTP code.
8. Create the account.

Login requires username, password, and the 6-digit TOTP code.

## Chat Flow

1. Add another account by username.
2. Open the contact from the sidebar.
3. Send text, emojis, images, or GIFs from the composer.
4. Click the reply icon beside any message to quote it in your next message.
5. Incoming messages, read receipts, and typing indicators refresh automatically while the chat is open.

Images and GIFs are currently stored as base64 data URLs in MongoDB. The frontend limits each attachment to 2.5 MB.

## Development Checks

Backend:

```bat
cd backend
Pro_venv\Scripts\python.exe manage.py check
Pro_venv\Scripts\python.exe manage.py test
```

Frontend:

```bat
cd frontend
npm run lint
npm run build
```

## Manual Backend Run

```bat
cd backend
Pro_venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

## Manual Frontend Run

```bat
cd frontend
npm run dev
```

## ngrok

Run one tunnel against the frontend:

```bat
ngrok http 3000
```

The frontend calls `/api`, and Vite proxies API requests to Django on `127.0.0.1:8000`.

## GitHub Upload Checklist

- Confirm `backend\.env` is not committed.
- Confirm `backend\Pro_venv`, `frontend\node_modules`, and `frontend\dist` are not committed.
- Keep `backend\.env.example` and `frontend\.env.example` committed.
- Run backend and frontend checks before pushing.

## License

MIT

## API Summary

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
