# Car Arena

A browser-based real-time multiplayer car arena game. Drive toward fuel cans to grow, ram smaller cars to destroy them, and climb the leaderboard.

## Tech Stack

- **Rendering** — Pixi.js v8 (WebGL)
- **Multiplayer** — uWebSockets.js
- **Server** — Node.js 20 LTS
- **Database** — Supabase (PostgreSQL)
- **Bundler** — Vite
- **Hosting** — GitHub Pages (client) + Railway.app (server)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env` and fill in your values:

```
PORT=9001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set up Supabase table

In your Supabase project, run this SQL in the SQL editor:

```sql
create table scores (
  username   text primary key,
  high_score int  not null default 0,
  updated_at timestamp with time zone default now()
);
```

### 4. Run locally

```bash
npm run dev
```

This starts both the Vite dev server (http://localhost:5173) and the game server (ws://localhost:9001) concurrently.

## Controls

| Action | Input |
|---|---|
| Move | Mouse — car follows cursor |
| Nitro boost | Spacebar (2s boost, 5s cooldown) |
| Respawn | Spacebar or click after death |

## Deployment

### Server → Railway.app

1. Push repo to GitHub
2. Create a new Railway project → Deploy from GitHub repo
3. Set environment variables in Railway dashboard:
   - `PORT` — Railway sets this automatically, leave it
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Railway will detect `npm run server` — set the start command to:
   ```
   node server/server.js
   ```
5. Copy the public Railway domain (e.g. `your-app.railway.app`)

### Client → GitHub Pages

1. Set your Railway WSS URL in `.env` (for the production build):
   ```
   VITE_WS_URL=wss://your-app.railway.app
   ```
2. Build the client:
   ```bash
   npm run build
   ```
3. Push the `dist/` folder to the `gh-pages` branch:
   ```bash
   npx gh-pages -d dist
   ```
4. Enable GitHub Pages in repo Settings → Pages → source: `gh-pages` branch

## Project Structure

```
car-arena/
├── client/
│   ├── index.html
│   ├── style.css
│   └── src/
│       ├── main.js          ← entry, Play button wiring
│       ├── game.js          ← Pixi app, game loop, camera, zoom, nitro
│       ├── network.js       ← WebSocket client
│       ├── renderer/
│       │   ├── carSprite.js
│       │   ├── fuelCan.js
│       │   ├── particles.js
│       │   └── worldMap.js
│       └── ui/
│           ├── hud.js
│           ├── leaderboard.js
│           └── screens.js
├── server/
│   ├── server.js
│   ├── gameLoop.js
│   ├── gameState.js
│   └── supabase.js
├── shared/
│   └── constants.js
└── .env
```
