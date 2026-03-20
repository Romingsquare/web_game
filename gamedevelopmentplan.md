# Game Development Plan
> ### AI INSTRUCTIONS — READ THIS ENTIRE FILE BEFORE DOING ANYTHING
>
> This file is the **single source of truth** for the entire project.
> It contains the full game design, architecture, tech decisions, and task tracker.
>
> **Your job each session:**
> 1. Read this entire file top to bottom.
> 2. Go to `## CURRENT SESSION TASK` — that is your ONLY job this session.
> 3. Write all code. Be complete — no placeholders, no "fill this in later".
> 4. When done, update the `## SESSION NOTES LOG` table with one summary line.
> 5. Tell the developer exactly which lines to change in `## CURRENT SESSION TASK` and `## PROGRESS TRACKER`.
> 6. **Never do more than one task per session.** Context will run out. Stay focused.
> 7. If the developer mentions a bug or issue, fix it before continuing the task.

---

## WHAT WE ARE BUILDING

A **browser-based real-time multiplayer car arena game** inspired by agar.io.

### Core gameplay loop
- Player opens the URL in a browser — no download, no install
- Player types a username and picks a car color → enters the arena
- Player controls a top-down car with the **mouse** — car always moves toward cursor
- **Fuel cans** are scattered across the map — driving over them grows your car
- A bigger car can **ram and destroy** a smaller car (must be ≥10% bigger radius)
- Destroyed players **respawn** at a random location at minimum size
- A live **leaderboard** panel shows the top 10 players by size in real time
- The **camera zooms out** smoothly as your car grows bigger
- The world is a large **4000×4000 city grid** — much bigger than the screen

### Visual style goals
- Dark asphalt background with subtle road grid lines
- Cars drawn as proper top-down vehicle shapes (body, wheels, windshield) — no image files
- Cars have a colored glow matching their player color using Pixi BlurFilter
- Fuel cans pulse with a soft scale+alpha sine wave animation
- Smooth camera lerp — no snapping
- Particle burst on destruction
- HUD: glassmorphism dark panels for leaderboard, size display, and mini-map
- Username floats above each car in a pill-shaped badge
- Speed lines briefly appear when nitro boost is active

---

## TECH STACK

| Layer | Tool | Why |
|---|---|---|
| Rendering | Pixi.js v8 (WebGL) | GPU-accelerated, glow filters, 5–10× faster than Canvas 2D |
| Multiplayer | uWebSockets.js (native WS) | 5× more connections than Socket.io, <200MB RAM, C++ core |
| Server runtime | Node.js 20 LTS | Stable, free, widely hosted |
| UI overlay | Vanilla HTML/CSS over canvas | Glassmorphism HUD without affecting Pixi render budget |
| Database | Supabase free tier | PostgreSQL, JS client, free 500MB |
| Frontend hosting | GitHub Pages | Free CDN, shareable link |
| Server hosting | Railway.app free tier | 500 free hours/month, supports Node + env vars |
| Bundler | Vite | Fast HMR in dev, optimized prod build |
| Version control | GitHub | Free, integrates with Railway and GitHub Pages |

### Why NOT alternatives
- ❌ Plain Canvas 2D — CPU-only, slow with many objects
- ❌ Socket.io — 5× worse throughput, 7× more RAM
- ❌ Phaser.js — heavy and opinionated, overkill for this game type
- ❌ Three.js — built for 3D, unnecessary for top-down 2D

---

## PROJECT FOLDER STRUCTURE

```
car-arena/
├── client/
│   ├── index.html                 ← canvas + HUD overlay divs + screen overlays
│   ├── style.css                  ← fullscreen layout, glassmorphism HUD, welcome screen
│   └── src/
│       ├── main.js                ← entry point
│       ├── game.js                ← Pixi app, main game loop, camera, zoom
│       ├── network.js             ← WebSocket client, send/receive messages
│       ├── renderer/
│       │   ├── carSprite.js       ← Pixi Graphics car shape + glow + username badge
│       │   ├── fuelCan.js         ← fuel can Graphics + pulse animation
│       │   ├── particles.js       ← death particle burst system
│       │   └── worldMap.js        ← background grid and road markings
│       └── ui/
│           ├── hud.js             ← size display + mini-map DOM updates
│           ├── leaderboard.js     ← live top-10 DOM panel
│           └── screens.js        ← welcome screen, death screen show/hide
├── server/
│   ├── server.js                  ← uWebSockets.js WS server + player connect/disconnect
│   ├── gameLoop.js                ← setInterval tick: collisions + food respawn + broadcast
│   ├── gameState.js               ← in-memory players Map + foods array
│   └── supabase.js                ← save high score on death, fetch all-time top 10
├── shared/
│   └── constants.js               ← all tuning values shared by client and server
├── .env                           ← SUPABASE_URL, SUPABASE_ANON_KEY, PORT
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

---

## SHARED CONSTANTS (shared/constants.js)

All values are named exports. Never hardcode these anywhere else.

- `MAP_SIZE = 4000` — world is 4000×4000 px
- `TICK_RATE = 20` — server broadcasts 20 times per second (every 50ms)
- `BASE_SPEED = 4` — px per frame at minimum size
- `BASE_RADIUS = 20` — starting car radius in px
- `FOOD_COUNT = 250` — fuel cans always present on map
- `FOOD_RADIUS = 8` — fuel can collision radius
- `FOOD_VALUE = 2` — radius growth per fuel can eaten
- `EAT_RATIO = 1.10` — must be 10% bigger radius to destroy another player
- `RESPAWN_SIZE = BASE_RADIUS`
- `MIN_ZOOM = 0.3` — most zoomed out (large player)
- `MAX_ZOOM = 1.2` — most zoomed in (small player)

---

## GAME SYSTEMS — TECHNICAL REFERENCE

### A. Pixi.js Scene Graph (client/src/game.js)
Pixi Application → stage → two children:
- `worldContainer` — moves and scales with camera each frame. Children: mapLayer, foodLayer, playerLayer, particleLayer
- `hudLayer` — fixed screen-space, never transforms

Camera each frame: set worldContainer.x/y so the local player stays centered on screen, factoring in current zoom scale. Zoom target = BASE_RADIUS / player.radius, clamped to MIN_ZOOM–MAX_ZOOM. All transitions use lerp with small alpha (0.03–0.08) for smooth feel.

### B. Car Shape (client/src/renderer/carSprite.js)
Drawn entirely with Pixi Graphics — no image files. Shape: rounded rectangle body in player color, small lighter rectangle for windshield at the front, four small dark rectangles for wheels at corners. A blurred copy of the body at 50% opacity creates the glow effect. The whole container rotates to match player.angle. Username rendered as PIXI.Text with black stroke, anchored to float above the car.

### C. Movement (client/src/game.js + network.js)
Mouse world position = screen mouse minus camera offset, divided by zoom. Each frame compute atan2 from player center to world mouse for angle, then move by cos/sin × speed. Speed = BASE_SPEED / sqrt(player.radius / BASE_RADIUS). Clamp x/y to map bounds. Send position to server every 50ms via WebSocket, not every frame.

### D. WebSocket Message Protocol
All messages are JSON strings. Fields use single-letter key `t` for type to save bytes.

CLIENT → SERVER:
- `{t:'join', username, color}` — sent once on connect
- `{t:'move', x, y, angle, radius}` — sent every 50ms

SERVER → CLIENT:
- `{t:'welcome', id, x, y, radius, mapSize}` — join confirmation
- `{t:'state', players:[{id,x,y,angle,radius,username,color}], foods:[{id,x,y}]}` — every tick
- `{t:'killed', killerId, killerName}` — when this player is destroyed
- `{t:'respawn', x, y, radius}` — after death
- `{t:'board', top:[{username,radius}]}` — top 10, every 2 seconds

State messages only include players and food within the receiver's viewport + 200px buffer for performance.

### E. Server (server/server.js)
uWebSockets.js App with a single `ws('/*')` handler. Each connected ws gets a `playerData` property attached with id, username, color, x, y, radius, angle, lastMove timestamp. On open: assign UUID, add to gameState. On message: parse JSON, route to join or move handler. On close: remove from gameState, notify others.

Separate `/health` GET endpoint returns 200 OK — needed for Railway deployment health checks.

### F. Server Game Loop (server/gameLoop.js)
setInterval at 1000/TICK_RATE ms. Each tick:
1. For every player, check distance to all food items — if overlap, grow player, remove food, spawn replacement
2. For every player pair, check distance — if one is 10% bigger and centers overlap, kill smaller one
3. Respawn any food below FOOD_COUNT
4. Broadcast filtered state to each client (viewport-culled)
5. Every 2 seconds (tick counter): broadcast leaderboard top 10

Collision formula: `Math.hypot(a.x - b.x, a.y - b.y)` compared to sum of radii.

### G. Visual Polish (client/src/renderer/)
- **Fuel can pulse**: sine wave on scale (±8%) and alpha (±20%) using Date.now() in Pixi ticker
- **Death particles**: on receiving killed event, spawn 8–12 circles at death position, each with random direction and speed 3–6px, fade alpha to 0 over 400ms, then remove from stage
- **Camera lerp**: cameraX/Y and currentZoom all lerp toward target each frame with small alpha
- **Client interpolation**: other players' display positions lerp toward latest server position each frame — prevents jitter between server ticks

### H. HUD (client/src/ui/ — DOM only, not Pixi)
All HUD elements are HTML divs with `position:fixed`, `pointer-events:none`, `z-index:10` over the canvas. Glassmorphism style: `background: rgba(0,0,0,0.55)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: 12px`.

- Leaderboard panel: top-right, updated by replacing innerHTML of an `<ol>` every time a board message arrives
- Size display: bottom-center pill, updated every frame
- Mini-map: 150×150 `<canvas>` bottom-right, redrawn every 200ms — dots scaled from 4000×4000 world to 150×150

### I. Supabase (server/supabase.js)
Table `scores`: columns `username (text, unique)`, `high_score (int)`, `updated_at (timestamp)`.
- On player death: if current radius > stored high_score, upsert the row
- All-time leaderboard: select top 10 ordered by high_score descending

---

## PROGRESS TRACKER

> Format: `- [x] DONE` | `- [ ] NOT STARTED` | `- [~] IN PROGRESS (session #)`

### Phase 1 — Project Setup & Skeleton
- [x] **TASK 1** — Init project: package.json, Vite config, folder structure, install all dependencies
- [x] **TASK 2** — index.html + style.css: canvas fullscreen, HUD overlay structure, welcome screen HTML
- [x] **TASK 3** — shared/constants.js + basic Pixi app running (black window, no errors)

### Phase 2 — Rendering Engine (Client, Single Player)
- [x] **TASK 4** — worldMap.js: draw dark grid background with road lines using Pixi Graphics
- [x] **TASK 5** — carSprite.js: draw a single player car (body, wheels, windshield, colored glow)
- [x] **TASK 6** — game.js: mouse tracking, car movement, camera follow with lerp, zoom system
- [x] **TASK 7** — fuelCan.js: draw 20 fuel cans with pulse animation, local eat-and-grow logic

### Phase 3 — Multiplayer Server
- [x] **TASK 8** — server.js: uWebSockets.js server, player join/disconnect, basic state management
- [x] **TASK 9** — gameState.js: in-memory player map, food array, spawn positions
- [x] **TASK 10** — gameLoop.js: server tick, collision detection (food + player), broadcast state
- [x] **TASK 11** — network.js (client): connect to server, send move, receive and parse state messages

### Phase 4 — Integration & Game Logic
- [x] **TASK 12** — Render all players from server state with client-side interpolation
- [x] **TASK 13** — Death + respawn flow: killed message, death screen DOM, respawn on keypress
- [x] **TASK 14** — particles.js: destruction burst effect on player death
- [x] **TASK 15** — Leaderboard: server sends top-10 every 2s, DOM leaderboard panel updates live

### Phase 5 — HUD, Polish & UI
- [x] **TASK 16** — hud.js: size display, mini-map canvas, smooth mini-map updates
- [x] **TASK 17** — screens.js: welcome screen (username + color picker), styled death screen
- [x] **TASK 18** — Speed lines boost effect + nitro mechanic (spacebar = brief speed boost, 5s cooldown)
- [x] **TASK 19** — CSS polish: Inter font, glassmorphism HUD panels, car color picker UI

### Phase 6 — Database & Deployment
- [x] **TASK 20** — supabase.js: create table, save high score on death, all-time leaderboard page
- [x] **TASK 21** — README.md: full setup instructions, env var guide
- [x] **TASK 22** — Deploy server to Railway.app: env vars, health check endpoint, get public WSS URL
- [x] **TASK 23** — Update network.js to use Railway URL in production, build with Vite
- [x] **TASK 24** — Deploy client build to GitHub Pages, end-to-end live test, ship it

----

## CURRENT SESSION TASK

> **AI: THIS IS YOUR ONLY JOB THIS SESSION.**
> **Developer: When starting a new session, paste this entire file, then say "work on TASK X".**

### TASK 2 — index.html + style.css

**Goal:** Opening `http://localhost:5173` shows a polished welcome screen — dark background, "Car Arena" title, username input, Play button. HUD elements (leaderboard panel, size display, mini-map canvas) exist in the DOM but are hidden. No console errors.

**index.html must include:**
- `<canvas id="gameCanvas">` filling the viewport
- `<div id="hud">` containing: `#leaderboard-panel` (top-right), `#size-display` (bottom-center), `<canvas id="mini-map" width="150" height="150">` (bottom-right)
- `#leaderboard-panel` contains an `<h3>Top Players</h3>` and `<ol id="leaderboard-list">`
- `<div id="screen-overlay" class="active">` containing `<div id="welcome-screen">` with h1, text input `#username-input`, and `<button id="play-btn">`
- Script tag: `<script type="module" src="src/main.js">`
- Google Fonts link for Inter (weights 400, 600, 700)

**style.css must include:**
- Reset: margin/padding 0, border-box
- Body: `#0d0d1a` background, overflow hidden, Inter font
- `#gameCanvas`: position absolute, top/left 0, display block
- `#hud`: position fixed, full size, pointer-events none, z-index 10
- HUD panels (leaderboard, size-display, mini-map): glassmorphism style — `rgba(0,0,0,0.55)` background, `backdrop-filter: blur(8px)`, 1px rgba white border, border-radius 12px, white text
- Leaderboard: position absolute top-right 20px, min-width 180px, h3 small uppercase muted label
- Size display: position absolute bottom-center, pill shape (border-radius 20px), padding 8px 20px
- Mini-map: position absolute bottom-right 20px, border-radius 8px
- `#screen-overlay`: position fixed, full inset, z-index 100, `rgba(10,10,26,0.92)` bg, `backdrop-filter: blur(10px)`, flexbox center. Hidden by default (`display:none`), shown when class `active` is present (`display:flex`)
- Welcome screen: flex column, centered, gap 18px
- h1: 48px, weight 700, letter-spacing -1px, white
- Input: 260px wide, centered text, rgba white border, rgba white bg, white text, rounded 10px, outline none, focus state brightens border
- Play button: `#5865f2` background, white text, 16px, weight 600, rounded 10px, hover darkens to `#4752c4`, cursor pointer

**What "done" looks like:**
- Welcome screen is visible and looks polished on load
- Clicking into input and typing works, placeholder text is visible
- Play button is clickable (no action yet — that comes in a later task)
- HUD elements exist in DOM but are not visible (hidden behind overlay)
- No console errors

**After completing:**
- Mark TASK 2 `[x] DONE` in Progress Tracker
- Update Session Notes Log row 2
- Tell developer: "Paste the updated file into a new AI session and say 'work on TASK 3'"

---

## SESSION NOTES LOG

| Session | Task | Status | Notes |
|---|---|---|---|
| 1 | TASK 1 | Complete | Project skeleton, all files created, deps installed, server confirmed running |
| 2 | TASK 2 | Complete | index.html + style.css done: Google Fonts, glassmorphism HUD, welcome screen with subtitle |
| 3 | TASK 3 | Complete | constants.js already done; Pixi v8 app init in game.js, scene graph layers created, main.js boots it |
| 4 | TASK 4 | Complete | worldMap.js: asphalt base, grid lines (minor/road), blue border |
| 5 | TASK 5 | Complete | carSprite.js: body, wheels, windshield, BlurFilter glow, username label, resizeCar() |
| 6 | TASK 6 | Complete | game.js: mouse tracking, atan2 movement, speed scaling, camera lerp, zoom lerp |
| 7 | TASK 7 | Complete | fuelCan.js: fuel can shape, sine pulse, spawnLocalFoods, checkFoodCollisions (eat+grow+respawn) |
| 8 | TASK 8 | Complete | uWS server: join/move/disconnect handlers, welcome message, health endpoint |
| 9 | TASK 9 | Complete | gameState: players Map, foods array, addPlayer, respawnPlayer, viewport culling |
| 10 | TASK 10 | Complete | gameLoop: food+player collision, respawn, state broadcast, leaderboard every 2s |
| 11 | TASK 11 | Complete | network.js: WS connect, sendJoin, move loop, onMessage routing; game.js wired with remote player interpolation + server food reconciliation |
| 12 | TASK 12 | Complete | Play button wires username into initGame, remote players render with lerp interpolation |
| 13 | TASK 13 | Complete | Death screen DOM added, screens.js show/hide, Space/click respawn, wired to killed+respawn messages |
| 14 | TASK 14 | Complete | particles.js: 10-12 burst circles, random angle+speed, alpha+scale fade over 400ms via rAF |
| 15 | TASK 15 | Complete | leaderboard.js updateLeaderboard(), local player highlighted, wired to board message |
| 16 | TASK 16 | Complete | hud.js: size display every frame, mini-map redraws every 200ms with food/players/local dot |
| 17 | TASK 17 | Complete | screens.js: 6-color swatch picker, getSelectedColor(), death screen flex layout |
| 18 | TASK 18 | Complete | Nitro: spacebar, 2s boost at 2.2× speed, 5s cooldown, speed lines canvas overlay |
| 19 | TASK 19 | Complete | Nitro bar HUD indicator, HUD hidden until game starts, CSS polish for all panels |
| 20 | TASK 20 | Complete | supabase.js: saveHighScore upsert on death, getAllTimeTop10, graceful no-op if env not set |
| 21 | TASK 21 | Complete | README.md: setup, controls, Supabase SQL, Railway + GitHub Pages deploy steps |
| 22 | TASK 22 | Complete | railway.json + Procfile, Node 20 engine pinned, /health endpoint already in server.js |
| 23 | TASK 23 | Complete | vite.config.js: production base path, VITE_WS_URL injected, .env.production template |
| 24 | TASK 24 | Complete | gh-pages installed, npm run deploy script added to package.json |

---

## KNOWN ISSUES & DECISIONS

| # | Decision | Reason |
|---|---|---|
| 1 | Pixi.js v8 for rendering | GPU-accelerated WebGL, glow filters, 5–10× faster than Canvas 2D |
| 2 | uWebSockets.js not Socket.io | 5× throughput, 7× less RAM, lower latency for game server |
| 3 | HUD as DOM, not canvas | Easier CSS styling, glassmorphism, doesn't affect Pixi render budget |
| 4 | Vite as bundler | Fast HMR in dev, optimized tree-shaken prod build |
| 5 | Server authoritative collision | Prevent cheating — client never decides who eats who |
| 6 | JSON messages in v1 | Simple to debug. Can upgrade to MessagePack binary in v2 for performance |
| 7 | shared/constants.js | Prevents bugs from client/server having different values for the same constant |

---

## HOW TO USE THIS FILE (for the developer, not for AI)

1. **First session:** Copy this entire file → paste as first message → say "work on TASK 1"
2. **Every session after:** Update file per AI instructions → paste updated file → say "work on TASK X"
3. **Switching AI tools:** Works with Claude, ChatGPT, Gemini — all context is in the file
4. **If something breaks:** Add the error to KNOWN ISSUES before starting the fix session
5. **Never skip tasks** — each task builds on the previous one's output
6. **One task per session** — context limits are real, stay focused