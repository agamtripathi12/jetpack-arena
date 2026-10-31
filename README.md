# Jetpack Arena v2 - Mini Militia style multiplayer shooter

Server-authoritative real-time 2D shooter for PC and phones. Up to 8 players per room.

## What's new in this version
- Global auto-match, private room codes, Solo vs Bots, Free-for-all and Team Deathmatch
- Longer jetpack flight (about 7.5 s per tank, plus a golden Jetpack Boost crate)
- 8 weapons (added Flamethrower, Mines), hit and death sound effects, Exit button (or Esc) to leave a match

## Features
- 6 weapons: AK-47, Shotgun, SMG, Sniper (laser sight), Rocket Launcher, Grenades. Carry 2 at a time.
- Weapon crates (swap your current weapon) and health crates, respawning every 14 s.
- 3 maps (Neon Grid, Sky Docks, Red Canyon). First to 15 kills wins; the map rotates after each match.
- Jetpack with fuel, recoil, explosions with knockback, kill feed, scoreboard, minimap.
- Graphics: parallax city/clouds/canyon backgrounds, glowing platforms, dynamic muzzle and explosion lighting,
  smoke, shockwaves, shell casings, damage numbers, screen shake, vignette.

## Run locally
1. Install Node.js 18+ (https://nodejs.org)
2. npm install
3. npm start
4. Open http://localhost:3000 in two tabs (or other devices on your Wi-Fi: http://YOUR-PC-IP:3000),
   enter the same room code, press PLAY.

## Publish (free) - Render.com
1. Upload this folder to a GitHub repo.
2. Render -> New -> Web Service -> select the repo.
3. Build Command: npm install    Start Command: npm start
4. Deploy and share the https://....onrender.com link. Same room code = same match.
(Static hosts like GitHub Pages / Netlify will NOT work - the game needs the Node server.)

## Controls
PC: A/D move, W or Space jetpack, mouse aim, click shoot, R reload, 1 / 2 / Q switch weapon.
Phone: left thumb = move (drag up = jetpack), right thumb = aim + auto-fire; buttons for reload / swap weapon.

## Tuning
Open server.js and edit the CFG block at the top: damage, health regeneration, respawn time, and bot speed / reaction time / aim / fire rate. Restart the server after changing.
