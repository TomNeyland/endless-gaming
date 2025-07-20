# Development Proxy Setup

This document explains how to set up the development environment with proxy configuration to access the backend API through the `/api/` prefix.

## Configuration Overview

The Angular CLI is configured to proxy all requests starting with `/api/` to the Flask backend running on `localhost:5000`. This simulates the production environment where the frontend and backend are served from the same host and port.

### Proxy Configuration

- **Frontend requests**: `/api/discovery/games/master.json`
- **Backend endpoint**: `localhost:5000/discovery/games/master.json`
- **Proxy rule**: `/api/*` → `http://localhost:5000/*` (strips `/api` prefix)

## Development Setup Instructions

### 1. Start the Backend Server

Navigate to the backend directory and start the Flask development server:

```bash
cd endless-gaming-backend
poetry shell
export FLASK_APP=app:create_app
export FLASK_ENV=development
poetry run flask run
```

The backend will be available at `http://localhost:5000`

### 2. Start the Frontend with Proxy

Navigate to the frontend directory and start the Angular development server:

```bash
cd endless-gaming-frontend
npm start
```

The frontend will be available at `http://localhost:4200` with proxy configuration automatically applied.

**Alternative**: Use the explicit proxy script:
```bash
npm run start:proxy
```

**Troubleshooting**: If the proxy isn't working, make sure you restarted the Angular dev server after creating the proxy configuration. The proxy is only applied when the server starts.

### 3. Test the Proxy Configuration

Open your browser and visit `http://localhost:4200`. The Angular application should successfully load game data through the proxy.

**Manual testing**:
- Direct backend: `http://localhost:5000/discovery/games/master.json`
- Through proxy: `http://localhost:4200/api/discovery/games/master.json`

Both should return the same JSON response with game data.

## How It Works

1. **Angular CLI Proxy**: The `proxy.conf.json` file configures the Angular CLI dev server to forward `/api/*` requests
2. **Path Rewriting**: The proxy strips the `/api` prefix before forwarding to the backend
3. **Service Configuration**: `GameDataService` makes requests to `/api/discovery/games/master.json`
4. **Request Flow**: Frontend → Angular CLI proxy → Flask backend → Response back through proxy

## Files Modified

- `proxy.conf.json` - Proxy configuration
- `angular.json` - Angular CLI serve configuration
- `game-data.service.ts` - Updated API URL to use `/api` prefix
- `package.json` - Added `start:proxy` script

## Production vs Development

- **Development**: Angular CLI proxy handles `/api/*` requests
- **Production**: Backend and frontend served from same host, `/api/*` routes configured in production server

This setup ensures the frontend code works identically in both environments.