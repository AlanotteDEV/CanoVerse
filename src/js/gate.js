/* ══════════════════════════════════════════════════════════════════
   CanoVerse — Schermata di attesa: countdown + minigioco "Lancio"
   ------------------------------------------------------------------
   Il sito resta coperto finché non scatta GATE_TARGET. Nel frattempo
   si può giocare: guida il razzo, raccogli le stelle, schiva i meteoriti.

   Per cambiare l'orario di apertura modifica GATE_TARGET qui sotto.
   Per saltare l'attesa (test): aggiungi ?skip all'indirizzo.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var GATE_TARGET = new Date('2026-08-07T11:00:00+02:00').getTime();

  var gate = document.getElementById('gate');
  if (!gate) return;

  /* ---------- Countdown ---------- */
  var elD = document.getElementById('g-d'),
      elH = document.getElementById('g-h'),
      elM = document.getElementById('g-m'),
      elS = document.getElementById('g-s');

  function pad(n) { return String(n).padStart(2, '0'); }

  function unlock() {
    gate.classList.add('is-open');
  }

  function tick() {
    var diff = GATE_TARGET - Date.now();
    if (diff <= 0) { unlock(); return; }
    elD.textContent = pad(Math.floor(diff / 86400000));
    elH.textContent = pad(Math.floor(diff / 3600000) % 24);
    elM.textContent = pad(Math.floor(diff / 60000) % 60);
    elS.textContent = pad(Math.floor(diff / 1000) % 60);
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- Entra nel sito ---------- */
  var enterBtn = document.getElementById('gate-enter');
  if (enterBtn) {
    enterBtn.addEventListener('click', function () {
      gate.remove();
      document.documentElement.classList.remove('gate-on');
      document.body.classList.remove('gate-on');
    });
  }

  /* ══════════════════════════════════════════════════════════════
     Minigioco: guida il razzo
     ══════════════════════════════════════════════════════════════ */
  var cv = document.getElementById('gate-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');

  var W = 460, H = 560;            // dimensioni logiche
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var rocketImg = new Image();
  rocketImg.src = 'src/img/intro-razzo.png';
  var rocketReady = false;
  rocketImg.onload = function () { rocketReady = true; };

  var scoreEl = document.getElementById('g-score'),
      bestEl = document.getElementById('g-best');

  var BEST_KEY = 'canoverse_gate_best';
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) {}
  if (bestEl) bestEl.textContent = best;

  var ship, rocks, stars, sparks, bg, score, speed, spawnT, over, started, t;

  function reset() {
    ship = { x: W / 2, y: H - 74, w: 42, h: 52, vx: 0 };
    rocks = [];
    stars = [];
    sparks = [];
    bg = [];
    for (var i = 0; i < 46; i++) {
      bg.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + .4, s: Math.random() * .5 + .25 });
    }
    score = 0;
    speed = 2.1;
    spawnT = 0;
    t = 0;
    over = false;
    if (scoreEl) scoreEl.textContent = '0';
  }
  reset();

  /* ---------- Comandi ---------- */
  var keys = {};
  var pointerX = null;

  document.addEventListener('keydown', function (e) {
    if (!gate.isConnected) return;
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' '].indexOf(e.key) !== -1) e.preventDefault();
    keys[e.key] = true;
    if (!started) started = true;
    if (over && (e.key === ' ' || e.key === 'Enter')) reset();
  });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });

  function pointerPos(e) {
    var r = cv.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return cx * (W / r.width);
  }
  function onDown(e) {
    started = true;
    if (over) { reset(); return; }
    pointerX = pointerPos(e);
  }
  function onMove(e) { if (pointerX !== null) { pointerX = pointerPos(e); e.preventDefault(); } }
  function onUp() { pointerX = null; }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove, { passive: false });
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('pointerleave', onUp);

  /* ---------- Disegno ----------
     Il disegno del razzo è inclinato di 64.7° e ha già le sue scie:
     lo ruoto per farlo salire dritto e lo centro sul CORPO (non sul
     riquadro dell'immagine), altrimenti la spinta risulta storta.     */
  var ROT = -64.7 * Math.PI / 180;
  var BODY_DX = 0.234;   // quanto il corpo è spostato rispetto al centro
  var BODY_DY = -0.019;  // (in frazioni della larghezza di disegno)

  function drawShip() {
    var w = 96, h = w * (rocketImg.height / rocketImg.width || .45);
    var puls = 1 + Math.sin(t / 9) * .03;                 // respiro del motore
    var bank = Math.max(-.22, Math.min(.22, ship.vx * .05)); // inclinazione in curva

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ROT + bank);
    ctx.scale(puls, puls);

    // bagliore di spinta dietro alla coda, allineato all'asse del razzo
    var gx = -(BODY_DX * w) - w * .30;
    var gr = w * (.20 + Math.sin(t / 4) * .03);
    var g = ctx.createRadialGradient(gx, 0, 0, gx, 0, gr);
    g.addColorStop(0, 'rgba(44,232,200,.55)');
    g.addColorStop(.5, 'rgba(255,45,149,.22)');
    g.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, 0, gr, 0, 6.2832);
    ctx.fill();

    if (rocketReady) {
      ctx.drawImage(rocketImg, -w / 2 - BODY_DX * w, -h / 2 - BODY_DY * w, w, h);
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(24, 0); ctx.lineTo(-14, 13); ctx.lineTo(-14, -13);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawRock(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.a);
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255,45,149,.9)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (var i = 0; i < r.pts.length; i++) {
      var p = r.pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawStar(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.strokeStyle = '#2ce8c8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(44,232,200,.95)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var ang = (Math.PI * 2 / 5) * i - Math.PI / 2;
      var ang2 = ang + Math.PI / 5;
      ctx.lineTo(Math.cos(ang) * s.r, Math.sin(ang) * s.r);
      ctx.lineTo(Math.cos(ang2) * s.r * .45, Math.sin(ang2) * s.r * .45);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function makeRock() {
    var r = 13 + Math.random() * 13;
    var pts = [], n = 7 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 / n) * i;
      var rr = r * (.72 + Math.random() * .45);
      pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }
    rocks.push({
      x: 26 + Math.random() * (W - 52), y: -34, r: r,
      a: Math.random() * 6.28, va: (Math.random() - .5) * .05,
      v: speed * (.85 + Math.random() * .5), pts: pts
    });
  }
  function makeStar() {
    stars.push({
      x: 26 + Math.random() * (W - 52), y: -26, r: 11,
      a: 0, v: speed * .9
    });
  }

  function boom(x, y) {
    for (var i = 0; i < 22; i++) {
      sparks.push({
        x: x, y: y,
        vx: (Math.random() - .5) * 7,
        vy: (Math.random() - .5) * 7,
        life: 30 + Math.random() * 20,
        c: Math.random() < .5 ? '#ff2d95' : '#2ce8c8'
      });
    }
  }

  /* ---------- Ciclo di gioco ---------- */
  function loop() {
    if (!gate.isConnected) return;   // gioco fermo quando si entra nel sito
    t++;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0520';
    ctx.fillRect(0, 0, W, H);

    // stelle di sfondo
    for (var i = 0; i < bg.length; i++) {
      var b = bg[i];
      b.y += b.s * (started && !over ? 1.6 : .5);
      if (b.y > H) { b.y = -2; b.x = Math.random() * W; }
      ctx.fillStyle = 'rgba(255,255,255,' + (.25 + b.r / 3) + ')';
      ctx.fillRect(b.x, b.y, b.r, b.r);
    }

    if (!started) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '700 17px ui-monospace, monospace';
      ctx.fillText('PREMI O TOCCA PER GIOCARE', W / 2, H / 2 - 6);
      ctx.fillStyle = '#9d90bd';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText('Raccogli le stelle · Schiva i meteoriti', W / 2, H / 2 + 20);
      drawShip();
      requestAnimationFrame(loop);
      return;
    }

    if (!over) {
      // movimento
      var prevX = ship.x;
      if (pointerX !== null) {
        ship.x += (pointerX - ship.x) * .22;
      } else {
        var dir = 0;
        if (keys.ArrowLeft || keys.a || keys.A) dir -= 1;
        if (keys.ArrowRight || keys.d || keys.D) dir += 1;
        ship.vx = ship.vx * .82 + dir * 1.5;
        ship.x += ship.vx;
      }
      ship.x = Math.max(24, Math.min(W - 24, ship.x));
      // velocità reale, così il razzo si inclina anche guidandolo col dito
      ship.vx = ship.vx * .35 + (ship.x - prevX) * .65;

      // difficoltà crescente
      speed = 2.1 + Math.min(score * .035, 4.4);
      spawnT--;
      if (spawnT <= 0) {
        spawnT = Math.max(16, 44 - score * .35);
        makeRock();
        if (Math.random() < .45) makeStar();
      }

      // meteoriti
      for (var i = rocks.length - 1; i >= 0; i--) {
        var r = rocks[i];
        r.y += r.v; r.a += r.va;
        if (r.y > H + 40) { rocks.splice(i, 1); continue; }
        var dx = r.x - ship.x, dy = r.y - ship.y;
        if (Math.hypot(dx, dy) < r.r + 17) {
          over = true;
          boom(ship.x, ship.y);
          if (score > best) {
            best = score;
            try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
            if (bestEl) bestEl.textContent = best;
          }
        }
      }

      // stelle da raccogliere
      for (var j = stars.length - 1; j >= 0; j--) {
        var s = stars[j];
        s.y += s.v; s.a += .04;
        if (s.y > H + 30) { stars.splice(j, 1); continue; }
        if (Math.hypot(s.x - ship.x, s.y - ship.y) < s.r + 20) {
          stars.splice(j, 1);
          score += 1;
          if (scoreEl) scoreEl.textContent = score;
          for (var k = 0; k < 8; k++) {
            sparks.push({ x: s.x, y: s.y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, life: 18, c: '#2ce8c8' });
          }
        }
      }
    }

    rocks.forEach(drawRock);
    stars.forEach(drawStar);

    // scintille
    for (var q = sparks.length - 1; q >= 0; q--) {
      var p = sparks[q];
      p.x += p.vx; p.y += p.vy; p.vy += .06; p.life--;
      if (p.life <= 0) { sparks.splice(q, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life / 40);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    }

    if (!over) drawShip();
    else {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff2d95';
      ctx.font = '900 30px ui-monospace, monospace';
      ctx.fillText('BOOM!', W / 2, H / 2 - 12);
      ctx.fillStyle = '#fff';
      ctx.font = '700 15px ui-monospace, monospace';
      ctx.fillText('Punteggio: ' + score, W / 2, H / 2 + 16);
      ctx.fillStyle = '#9d90bd';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText('Tocca o premi SPAZIO per rigiocare', W / 2, H / 2 + 42);
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
