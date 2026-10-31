// Jetpack Arena v2 - authoritative multiplayer server (HTTP + WebSocket). 60 Hz sim, 30 Hz snapshots.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, 'public');
const server = http.createServer((req, res) => {
  let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
  const p = path.join(PUB, path.normalize(f));
  if (!p.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, b) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(b);
  });
});

const WIN_KILLS = 15, MAXP = 8;
// ================= TUNING (change these numbers to adjust the game) =================
const CFG = {
  dmg: 0.6,          // damage multiplier for ALL weapons (1 = original, lower = longer fights)
  regenDelay: 5,     // seconds without being hit before health starts regenerating
  regen: 8,          // health regenerated per second
  respawn: 3,        // seconds before a dead player respawns
  botSpeed: 0.7,     // bot walking speed (1 = same as players)
  botJet: 0.65,      // bot jetpack power (1 = same as players)
  botReact: 0.35,    // bot reaction time in seconds (higher = slower, easier bots)
  botDelay: 0.7,     // seconds a bot must see you before it starts shooting
  botAim: 0.22,      // bot aim error in radians (higher = misses more)
  botFire: 0.5       // chance a bot keeps firing each decision (0..1)
};
// =====================================================================================
// ---- weapons: id order is shared with the client ----
const WEAP = [
  { n: 'AK-47',   rate: .09,  mag: 30, rel: 1.4, dmg: 9,  pel: 1, spread: .03, spd: 1500, life: .9,  rec: 25 },
  { n: 'Shotgun', rate: .75,  mag: 6,  rel: 1.8, dmg: 11, pel: 7, spread: .16, spd: 1250, life: .35, rec: 260 },
  { n: 'SMG',     rate: .055, mag: 40, rel: 1.3, dmg: 6,  pel: 1, spread: .08, spd: 1400, life: .6,  rec: 15 },
  { n: 'Sniper',  rate: 1.1,  mag: 5,  rel: 2.2, dmg: 75, pel: 1, spread: 0,   spd: 3200, life: 1.1, rec: 220 },
  { n: 'Rocket',  rate: 1.2,  mag: 3,  rel: 2.4, dmg: 90, pel: 1, spread: 0,   spd: 950,  life: 3,   rec: 200, k: 'r', rad: 140 },
  { n: 'Grenade', rate: .9,   mag: 3,  rel: 2,   dmg: 85, pel: 1, spread: 0,   spd: 700,  life: 2.6, rec: 0,   k: 'g', rad: 150 },
  { n: 'Flame',   rate: .035, mag: 120, rel: 2.2, dmg: 3.5, pel: 1, spread: .14, spd: 520, life: .38, rec: 6, k: 'f' },
  { n: 'Mine',    rate: .8,   mag: 3,  rel: 2.5, dmg: 100, pel: 1, spread: 0,   spd: 160, life: 90,  rec: 0, k: 'm', rad: 130 }
];
// ---- maps ----
const MAPS = [
  { n: 'Neon Grid', W: 2400, H: 1300,
    PL: [{x:0,y:1250,w:2400,h:50},{x:300,y:1000,w:400,h:30},{x:1000,y:900,w:400,h:30},{x:1700,y:1000,w:400,h:30},{x:600,y:700,w:350,h:30},
         {x:1450,y:700,w:350,h:30},{x:1000,y:480,w:400,h:30},{x:100,y:500,w:300,h:30},{x:2000,y:500,w:300,h:30},{x:1150,y:1120,w:100,h:130}],
    SP: [[500,974],[1200,874],[1900,974],[775,674],[1625,674],[1200,454],[250,474],[2150,474],[200,1224],[2200,1224]],
    cr: [1,2,3,4,5,6,7],
    th: { k: 'city', s: ['#070b24','#2a1b4d','#7a2f63'], a: '#4dd2ff', b: ['#41468a','#12153a'] } },
  { n: 'Sky Docks', W: 3000, H: 1500,
    PL: [{x:0,y:1450,w:3000,h:50},{x:200,y:1230,w:380,h:28},{x:1100,y:1230,w:800,h:28},{x:2420,y:1230,w:380,h:28},
         {x:500,y:1000,w:420,h:28},{x:1290,y:1000,w:420,h:28},{x:2080,y:1000,w:420,h:28},
         {x:100,y:780,w:360,h:28},{x:800,y:780,w:300,h:28},{x:1900,y:780,w:300,h:28},{x:2540,y:780,w:360,h:28},
         {x:450,y:560,w:400,h:28},{x:1300,y:560,w:400,h:28},{x:2150,y:560,w:400,h:28},{x:1100,y:330,w:800,h:28}],
    SP: [[300,1424],[2700,1424],[390,1204],[1500,1204],[2610,1204],[710,974],[1500,974],[2290,974],[280,754],[950,754],[2050,754],[2720,754],[650,534],[1500,534],[2350,534],[1500,304]],
    cr: [3,5,6,7,8,9,10,12,13,14,15],
    th: { k: 'sky', s: ['#0b1b4a','#2b5fa8','#f7a8a0'], a: '#ffd6a5', b: ['#6a83c9','#2a3a78'] } },
  { n: 'Red Canyon', W: 2600, H: 1800,
    PL: [{x:0,y:1750,w:2600,h:50},{x:0,y:0,w:90,h:1800},{x:2510,y:0,w:90,h:1800},
         {x:90,y:1500,w:300,h:28},{x:90,y:1200,w:260,h:28},{x:90,y:900,w:300,h:28},{x:90,y:600,w:260,h:28},
         {x:2210,y:1500,w:300,h:28},{x:2250,y:1200,w:260,h:28},{x:2210,y:900,w:300,h:28},{x:2250,y:600,w:260,h:28},
         {x:1250,y:1100,w:100,h:650},{x:1050,y:1100,w:500,h:28},{x:600,y:1350,w:380,h:28},{x:1620,y:1350,w:380,h:28},
         {x:650,y:1000,w:350,h:28},{x:1600,y:1000,w:350,h:28},{x:900,y:700,w:300,h:28},{x:1400,y:700,w:300,h:28},{x:1050,y:400,w:500,h:28}],
    SP: [[300,1724],[2300,1724],[800,1724],[240,1474],[220,1174],[240,874],[220,574],[2360,1474],[2380,1174],[2360,874],[2380,574],[790,1324],[1810,1324],[825,974],[1775,974],[1050,674],[1550,674],[1300,374],[1300,1074]],
    cr: [3,5,7,8,10,11,13,14,15,16,17],
    th: { k: 'canyon', s: ['#2b0f2e','#a8432f','#ffb15e'], a: '#ff9f4d', b: ['#8a4a3a','#3a1a1c'] } }
];

const pick = a => a[Math.floor(Math.random() * a.length)];
function roll(c) { const r = Math.random(); if (r < .28) c.k = 'h'; else if (r < .4) c.k = 'j'; else { c.k = 'w'; c.w = pick([0, 1, 1, 2, 3, 4, 5, 5, 6, 6, 7]); } }
function loadMap(R) {
  R.m = MAPS[R.mi]; R.b = [];
  R.cr = R.m.cr.map(i => { const c = { x: R.m.SP[i][0], y: R.m.SP[i][1] + 12, t: 0 }; roll(c); return c; });
}
function welcome(R, p) {
  const m = R.m;
  p.ws.send(JSON.stringify({ t: 'w', id: p.id, mode: R.mode, label: R.label, tm: p.tm, map: { n: m.n, W: m.W, H: m.H, PL: m.PL, cr: R.cr.map(c => [c.x, c.y]), th: m.th } }));
}
function spawn(R, p) {
  const s = pick(R.m.SP);
  Object.assign(p, { x: s[0], y: s[1], vx: 0, vy: 0, hp: 100, fuel: 100, al: true, g: false, jet: 0, wp: [0, 2], am: [30, 40], sl: 0, rl: 0, cd: 0, rt: 0, bo: 0, fc: 0, lh: 0 });
}
const hit = (p, r) => p.x + 13 > r.x && p.x - 13 < r.x + r.w && p.y + 25 > r.y && p.y - 25 < r.y + r.h;
function move(R, p, dt) {
  const m = R.m;
  p.x += p.vx * dt;
  for (const r of m.PL) if (hit(p, r)) { p.x = p.vx > 0 ? r.x - 13 : r.x + r.w + 13; p.vx = 0; }
  p.y += p.vy * dt; p.g = false;
  for (const r of m.PL) if (hit(p, r)) { if (p.vy > 0) { p.y = r.y - 25; p.g = true; } else p.y = r.y + r.h + 25; p.vy = 0; }
  p.x = Math.max(13, Math.min(m.W - 13, p.x)); if (p.y < 25) { p.y = 25; p.vy = 0; }
}
function solid(R, x, y) {
  const m = R.m; if (x < 0 || x > m.W || y > m.H || y < 0) return true;
  for (const r of m.PL) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  return false;
}
const friendly = (R, a, b) => R.mode === 'tdm' && a && b && a.tm === b.tm;
function dmgP(R, p, amt, o, kx, ky) {
  if (!p.al) return;
  const k = R.ps.get(o), other = k && k !== p;
  if (other && friendly(R, k, p)) return;
  amt *= CFG.dmg; p.lh = 0; p.hp -= amt; p.vx += kx; p.vy += ky; R.ev.push({ e: 'h', x: p.x, y: p.y - 6, d: Math.round(amt), vi: p.id });
  if (p.hp <= 0) {
    p.al = false; p.rt = CFG.respawn; p.d++; p.bo = 0;
    if (other) { k.k++; if (R.mode === 'tdm') R.ts[k.tm]++; }
    R.ev.push({ e: 'd', x: p.x, y: p.y, v: p.n, k: other ? k.n : p.n, c: p.c, vi: p.id, tm: p.tm });
    if (!R.win && other) {
      if (R.mode === 'tdm') { if (R.ts[k.tm] >= TEAM_WIN) { R.win = TN[k.tm] + ' Team'; R.wt = 7; } }
      else if (k.k >= WIN_KILLS) { R.win = k.n; R.wt = 7; }
    }
  }
}
function boom(R, x, y, w, o) {
  R.ev.push({ e: 'x', x, y, r: w.rad });
  for (const p of R.ps.values()) {
    if (!p.al) continue;
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d < w.rad + 20) { const f = 1 - d / (w.rad + 20);
      dmgP(R, p, w.dmg * f * (p.id === o ? .6 : 1), o, dx / (d || 1) * 700 * f, dy / (d || 1) * 700 * f - 150 * f); }
  }
}
function step(R, dt) {
  for (const c of R.cr) if (c.t > 0) c.t -= dt;
  for (const p of R.ps.values()) {
    if (p.bot) think(R, p, dt);
    const i = p.i;
    if (!p.al) { p.rt -= dt; if (p.rt <= 0) spawn(R, p); continue; }
    p.vx += ((i.r - i.l) * 300 * (p.bot ? CFG.botSpeed : 1) - p.vx) * Math.min(1, (p.g ? 14 : 4) * dt);
    p.vy += 1500 * dt; p.jet = 0; if (p.bo > 0) p.bo -= dt;
    p.lh += dt; if (p.lh > CFG.regenDelay && p.hp < 100) p.hp = Math.min(100, p.hp + CFG.regen * dt);
    if (i.j && p.fuel > 0) { p.vy -= 2900 * dt * (p.bot ? CFG.botJet : 1); const cap = (p.bo > 0 ? -560 : -460) * (p.bot ? CFG.botJet : 1); if (p.vy < cap) p.vy = cap; if (p.bo <= 0) p.fuel -= 13 * dt; p.jet = 1; }
    else p.fuel = Math.min(100, p.fuel + (p.g ? 35 : 4) * dt);
    if (i.w !== p.sl) { p.sl = i.w; p.rl = 0; }
    const wid = p.wp[p.sl], w = WEAP[wid]; p.cd -= dt;
    if (p.rl > 0) { p.rl -= dt; if (p.rl <= 0) p.am[p.sl] = w.mag; }
    else if (i.rl && p.am[p.sl] < w.mag) p.rl = w.rel;
    if (i.s && p.cd <= 0 && p.rl <= 0) {
      if (p.am[p.sl] > 0) {
        p.cd = w.rate; p.am[p.sl]--;
        const ox = p.x + Math.cos(i.a) * 28, oy = p.y - 4 + Math.sin(i.a) * 28;
        for (let k = 0; k < w.pel; k++) {
          const a = i.a + (Math.random() - .5) * 2 * w.spread;
          R.b.push({ x: ox, y: oy, vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd - (w.k === 'g' ? 120 : 0), o: p.id, l: w.life, w: wid, t: w.k || 'b', arm: 1 });
        }
        p.vx -= Math.cos(i.a) * w.rec; p.vy -= Math.sin(i.a) * w.rec * .6;
        if (w.k !== 'f' || (p.fc = (p.fc + 1) % 3) === 0) R.ev.push({ e: 'f', x: ox, y: oy, a: i.a, w: wid });
      } else p.rl = w.rel;
    }
    move(R, p, dt);
    for (const c of R.cr) {
      if (c.t > 0 || Math.abs(p.x - c.x) > 26 || Math.abs(p.y - c.y) > 36) continue;
      if (c.k === 'j') { p.bo = 8; p.fuel = 100; }
      else if (c.k === 'h') { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 50); }
      else { const j = p.wp.indexOf(c.w);
        if (j >= 0) p.am[j] = WEAP[c.w].mag; else { p.wp[p.sl] = c.w; p.am[p.sl] = WEAP[c.w].mag; p.rl = 0; } }
      c.t = 14; roll(c); R.ev.push({ e: 'u', x: c.x, y: c.y });
    }
  }
  for (let n = R.b.length - 1; n >= 0; n--) {
    const b = R.b[n], w = WEAP[b.w];
    const sub = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 16)), h = dt / sub;
    let dead = false; b.l -= dt;
    for (let s = 0; s < sub && !dead; s++) {
      if (b.t === 'g' || b.t === 'm') {
        const M = b.t === 'm';
        b.vy += 1200 * h;
        let nx = b.x + b.vx * h; if (solid(R, nx, b.y)) { b.vx = M ? 0 : b.vx * -.5; nx = b.x; } b.x = nx;
        let ny = b.y + b.vy * h; if (solid(R, b.x, ny)) { if (M) { b.vy = 0; b.vx = 0; } else { b.vy = Math.abs(b.vy) < 80 ? 0 : b.vy * -.45; b.vx *= .85; } ny = b.y; } b.y = ny;
        if (M) { b.arm -= h; if (b.arm <= 0) { const ow = R.ps.get(b.o);
          for (const p of R.ps.values()) { if (!p.al || p.id === b.o || friendly(R, ow, p)) continue;
            if (Math.abs(p.x - b.x) < 40 && Math.abs(p.y - b.y) < 48) { dead = true; boom(R, b.x, b.y, w, b.o); break; } } } }
      } else {
        if (b.t === 'r') b.vy += 60 * h;
        b.x += b.vx * h; b.y += b.vy * h;
        if (solid(R, b.x, b.y)) { dead = true; if (b.t === 'r') boom(R, b.x, b.y, w, b.o); else if (b.t !== 'f') R.ev.push({ e: 's', x: b.x, y: b.y }); break; }
        for (const p of R.ps.values()) {
          if (!p.al || p.id === b.o || Math.abs(b.x - p.x) > 16 || Math.abs(b.y - p.y) > 28 || friendly(R, R.ps.get(b.o), p)) continue;
          dead = true;
          if (b.t === 'r') boom(R, b.x, b.y, w, b.o); else dmgP(R, p, w.dmg, b.o, b.vx * .02, 0);
          break;
        }
      }
    }
    if (!dead && b.l <= 0) { dead = true; if (b.t === 'g') boom(R, b.x, b.y, w, b.o); }
    if (dead) R.b.splice(n, 1);
  }
  if (R.win && (R.wt -= dt) <= 0) {   // match over -> next map
    R.win = null; R.ts = [0, 0]; R.mi = (R.mi + 1) % MAPS.length; loadMap(R);
    for (const p of R.ps.values()) { p.k = 0; p.d = 0; spawn(R, p); welcome(R, p); }
  }
}
function snapshot(R) {
  const r = Math.round, K = { b: 0, r: 1, g: 2, f: 3, m: 4 };
  const msg = JSON.stringify({ t: 's', win: R.win, ev: R.ev, mode: R.mode, ts: R.ts,
    b: R.b.map(b => [r(b.x), r(b.y), r(b.vx), r(b.vy), K[b.t]]),
    c: R.cr.map(c => c.t > 0 ? -2 : c.k === 'h' ? -1 : c.k === 'j' ? -3 : c.w),
    p: [...R.ps.values()].map(p => ({ id: p.id, x: r(p.x), y: r(p.y), vx: r(p.vx), a: +p.i.a.toFixed(2), hp: r(p.hp), f: r(p.fuel),
      w: p.wp, am: p.am, sl: p.sl, rl: p.rl > 0 ? 1 : 0, j: p.jet, k: p.k, d: p.d, al: p.al ? 1 : 0, rt: Math.ceil(p.rt), n: p.n, c: p.c, tm: p.tm, bo: p.bo > 0 ? 1 : 0 })) });
  R.ev = [];
  for (const p of R.ps.values()) if (p.ws.readyState === 1) p.ws.send(msg);
}
const TEAM_WIN = 30, TN = ['Red', 'Blue'], BN = ['Rex', 'Nova', 'Blitz', 'Viper', 'Echo', 'Ghost', 'Rogue', 'Bolt'];
const rooms = new Map(); let nextId = 1, gcount = 0;
setInterval(() => { for (const R of rooms.values()) step(R, 1 / 60); }, 1000 / 60);
setInterval(() => { for (const R of rooms.values()) snapshot(R); }, 1000 / 30);

function teamFor(R) { let a = 0, b = 0; for (const p of R.ps.values()) p.tm ? b++ : a++; return a <= b ? 0 : 1; }
function freeColor(R) { const used = new Set([...R.ps.values()].map(p => p.c)); let c = 0; while (used.has(c)) c++; return c; }
function los(R, ax, ay, bx, by) { for (let k = 1; k < 14; k++) if (solid(R, ax + (bx - ax) * k / 14, ay + (by - ay) * k / 14)) return false; return true; }
// ---- bot AI ----
function think(R, p, dt) {
  const old = p.i;
  if (!p.al) { p.i = { l: 0, r: 0, j: 0, s: 0, rl: 0, w: p.sl, a: old.a }; return; }
  p.bt = (p.bt || 0) - dt; if (p.bt > 0) return; p.bt = CFG.botReact;
  let t = null, td = 1e9;
  for (const q of R.ps.values()) { if (q === p || !q.al || friendly(R, p, q)) continue; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < td) { td = d; t = q; } }
  const i = { l: 0, r: 0, j: 0, s: 0, rl: 0, w: p.sl, a: old.a };
  const seen = !!t && td < 1000 && los(R, p.x, p.y - 4, t.x, t.y - 4);
  let gx = p.x, gy = p.y;
  if (seen) {
    const rank = td > 600 ? [3, 4, 0, 2, 5, 6, 1, 7] : td < 250 ? [1, 6, 2, 0, 5, 4, 3, 7] : [0, 2, 4, 3, 1, 5, 6, 7];
    const sc = sl => p.am[sl] > 0 ? rank.indexOf(p.wp[sl]) : 99;
    if (p.rl <= 0) i.w = sc(1) < sc(0) ? 1 : 0;
    const wid = p.wp[i.w];
    let a = Math.atan2(t.y - p.y, t.x - p.x) + (Math.random() - .5) * 2 * (CFG.botAim + td / 5000);
    if (wid === 5) a -= Math.min(.6, td / 1800);
    p.sw = (p.sw || 0) + CFG.botReact; i.a = a; i.s = (wid === 7 || p.sw < CFG.botDelay) ? 0 : (Math.random() < CFG.botFire ? 1 : 0); gx = t.x; gy = t.y;
    const dx = t.x - p.x, dir = p.sd || 1;
    if (td > 450) { i.r = dx > 0 ? 1 : 0; i.l = dx < 0 ? 1 : 0; }
    else if (td < 220) { i.r = dx < 0 ? 1 : 0; i.l = dx > 0 ? 1 : 0; }
    else { i.r = dir > 0 ? 1 : 0; i.l = dir < 0 ? 1 : 0; }
  } else {
    p.sw = 0; if (p.am[p.sl] < WEAP[p.wp[p.sl]].mag) i.rl = 1;
    let best = null, bd = 1e9;
    for (const c of R.cr) { if (c.t > 0) continue; const d = Math.hypot(c.x - p.x, c.y - p.y) - (c.k === 'h' && p.hp < 60 ? 600 : 0); if (d < bd) { bd = d; best = c; } }
    const tg = best && bd < 1400 ? best : t;
    if (tg) { gx = tg.x; gy = tg.y; const dx = gx - p.x; if (dx > 30) i.r = 1; else if (dx < -30) i.l = 1; }
    i.a = i.r ? 0 : i.l ? Math.PI : old.a;
  }
  const ahead = (i.r || i.l) && solid(R, p.x + (i.r ? 34 : -34), p.y + 10);
  if (p.fuel > 8 && (gy < p.y - 70 || ahead || (!p.g && p.vy > 300 && p.y > gy - 30))) i.j = 1;
  if (Math.random() < .03) p.sd = -(p.sd || 1);
  p.i = i;
}
function addBot(R) {
  const p = { id: nextId++, ws: { readyState: 0, send() {} }, bot: 1, c: freeColor(R), k: 0, d: 0, n: pick(BN), tm: teamFor(R), i: { l: 0, r: 0, j: 0, s: 0, rl: 0, w: 0, a: 0 } };
  spawn(R, p); R.ps.set(p.id, p);
}
function makeRoom(code, o) {
  const R = { code, label: o.label, pub: !!o.pub, mode: o.mode === 'tdm' ? 'tdm' : 'ffa', ps: new Map(), b: [], ev: [], win: null, wt: 0, ts: [0, 0],
    mi: Number.isInteger(o.map) && o.map >= 0 && o.map < MAPS.length ? o.map : 0 };
  loadMap(R); rooms.set(code, R);
  for (let k = 0; k < Math.min(4, o.bots | 0); k++) addBot(R);
  return R;
}
function leave(ws) {
  const R = ws.room; if (!R) return;
  R.ps.delete(ws.pid); ws.room = null;
  if (![...R.ps.values()].some(p => !p.bot)) rooms.delete(R.code);
}
const wss = new WebSocketServer({ server, maxPayload: 512 });
wss.on('connection', ws => {
  ws.room = null;
  ws.on('message', raw => {
    let d; try { d = JSON.parse(raw); } catch { return; }
    if (d.t === 'join' && !ws.room) {
      let R;
      if (d.global) {   // auto-match into a public room (creates one with bot fillers if none has space)
        R = [...rooms.values()].filter(r => r.pub && r.ps.size < MAXP).sort((a, b) => b.ps.size - a.ps.size)[0];
        if (!R) { gcount++; R = makeRoom('G' + gcount, { pub: 1, label: 'Global #' + gcount, map: Math.floor(Math.random() * MAPS.length), mode: 'ffa', bots: 3 }); }
      } else {
        const code = String(d.room || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12); if (!code) return;
        R = rooms.get(code) || makeRoom(code, { label: 'Room ' + code, map: d.map, mode: d.mode, bots: d.bots });
      }
      if (R.ps.size >= MAXP) { const bot = [...R.ps.values()].find(p => p.bot); if (bot) R.ps.delete(bot.id); else return ws.send(JSON.stringify({ t: 'full' })); }
      const p = { id: nextId++, ws, c: freeColor(R), k: 0, d: 0, tm: teamFor(R),
        n: String(d.name || 'Player').replace(/[^\w \-]/g, '').slice(0, 12) || 'Player', i: { l: 0, r: 0, j: 0, s: 0, rl: 0, w: 0, a: 0 } };
      spawn(R, p); R.ps.set(p.id, p); ws.room = R; ws.pid = p.id; welcome(R, p);
      if (R.pub) { const humans = [...R.ps.values()].filter(q => !q.bot).length, bots = [...R.ps.values()].filter(q => q.bot);
        if (humans >= 2 && bots.length) R.ps.delete(bots[0].id); }
    } else if (d.t === 'i' && ws.room) {
      const p = ws.room.ps.get(ws.pid);
      p.i = { l: +!!d.l, r: +!!d.r, j: +!!d.j, s: +!!d.s, rl: +!!d.rl, w: d.w === 1 ? 1 : 0, a: Number.isFinite(d.a) ? d.a : 0 };
    }
  });
  ws.on('close', () => leave(ws));
});
server.listen(PORT, () => console.log('Jetpack Arena v2 on http://localhost:' + PORT));
