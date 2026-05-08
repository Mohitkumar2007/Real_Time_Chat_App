# ByteTalk Frontend

React/Vite frontend for ByteTalk.

The UI uses a glass-style visual system, local QR generation for TOTP setup, and a Vite `/api` proxy to the Django backend.

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

Manual frontend install:

```bat
cd frontend
npm install
```

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

Manual frontend run:

```bat
cd frontend
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:3000/
```

## API Proxy

The frontend calls `/api`. Vite proxies `/api` to:

```text
http://127.0.0.1:8000
```

This supports local use and `ngrok http 3000`.

## Checks

```bat
npm run lint
npm run build
```
