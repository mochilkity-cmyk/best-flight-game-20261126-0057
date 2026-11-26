// Skycourier — Island Run: the game itself.
// One job: the state machine (title -> briefing -> flying -> landed/crashed),
// the missions and their scoring, ring collection, and the end-of-sortie
// debrief. Physics lives in plane.js, pixels in render.js and hud.js.

import { MISSIONS, PLANE } from './config.js';
import { createPlane, resetPlane, stepPlane } from './plane.js';
import { renderFrame, createRenderer } from './render.js';
import { drawHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildTerrain, buildClouds } from './terrain.js';

const RING_RADIUS = 26;

export function createGame(canvas) {
  const renderer = createRenderer(canvas);
  const terrain = buildTerrain();
  const clouds = buildClouds();
  const input = createInput(canvas);
  const audio = createAudio();
  const plane = createPlane(terrain);

  const game = {
    screen: 'title', // title | briefing | flying | paused | done
    missionIndex: 0,
    mission: MISSIONS[0],
    rings: [],
    nextRing: 0,
    score: 0,
    timeLeft: 0,
    time: 0, // seconds since the sortie started
    frame: 0,
    camera: 'chase',
    message: null,
    messageColour: null,
    messageUntil: 0,
    result: null, // { title, lines[], won }
    muted: false,
    frozen: false, // screenshot mode: stop advancing after the preset settles
  };

  function startMission(index) {
    game.missionIndex = index;
    game.mission = MISSIONS[index];
    game.rings = game.mission.rings.map(([x, y, z]) => ({ x, y, z, done: false }));
    game.nextRing = 0;
    game.score = 0;
    game.timeLeft = game.mission.timeLimit;
    game.time = 0;
    game.result = null;
    game.message = null;
    resetPlane(plane, game.mission, terrain);
    game.screen = 'flying';
    audio.unlock();
    audio.click();
    showMessage(`MISSION: ${game.mission.name}`, '#ffb347', 3);
  }

  function showMessage(text, colour, seconds) {
    game.message = text;
    game.messageColour = colour || '#eaf6ff';
    game.messageUntil = game.time + seconds;
  }

  function endSortie(won, title, lines) {
    game.screen = 'done';
    game.result = { title, lines, won };
    if (won) audio.land();
    else audio.crash();
  }

  function checkRings() {
    if (game.nextRing >= game.rings.length) return;
    const ring = game.rings[game.nextRing];
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    if (dx * dx + dy * dy + dz * dz < RING_RADIUS * RING_RADIUS) {
      ring.done = true;
      game.nextRing++;
      const bonus = 500 + Math.round(plane.speed);
      game.score += bonus;
      audio.ring();
      if (game.nextRing >= game.rings.length) {
        if (game.mission.needsLanding) {
          showMessage('ALL RINGS — NOW LAND ON THE RUNWAY', '#7dff9b', 4);
        } else {
          const timeBonus = Math.round(game.timeLeft) * 2;
          game.score += timeBonus;
          endSortie(true, 'RING RUN COMPLETE', [
            `All ${game.rings.length} rings threaded.`,
            `Time bonus +${timeBonus} — ${Math.round(game.timeLeft)}s to spare.`,
            `Final score: ${game.score}`,
          ]);
        }
      } else {
        showMessage(`RING ${game.nextRing} / ${game.rings.length}  +${bonus}`, '#7dff9b', 2);
      }
    }
  }

  function finishLanding() {
    // Touchdown quality: slow and gentle pays.
    const softness = Math.max(0, 1 - Math.abs(plane.verticalSpeed) / 4.5);
    const speedBonus = Math.max(0, 1 - plane.speed / 55);
    const bonus = Math.round(400 + 600 * softness + 300 * speedBonus);
    game.score += bonus;
    const timeBonus = Math.round(game.timeLeft) * 2;
    game.score += timeBonus;
    endSortie(true, 'WHEELS DOWN — SORTIE COMPLETE', [
      `Landed on runway 09 at Coral Bay.`,
      `Touchdown bonus +${bonus}, time bonus +${timeBonus}.`,
      `Final score: ${game.score}`,
    ]);
  }

  function update(dt) {
    if (game.screen !== 'flying') return;
    game.time += dt;
    game.frame++;
    game.timeLeft -= dt;

    // One-shot keys.
    if (input.wasPressed('KeyG')) {
      plane.gearDown = !plane.gearDown;
      showMessage(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', '#eaf6ff', 1.2);
    }
    if (input.wasPressed('KeyC')) {
      game.camera = game.camera === 'chase' ? 'cockpit' : 'chase';
    }
    if (input.wasPressed('KeyM')) {
      game.muted = audio.toggleMute();
      showMessage(game.muted ? 'SOUND OFF' : 'SOUND ON', '#eaf6ff', 1.2);
    }
    if (input.wasPressed('KeyP')) {
      game.screen = 'paused';
      return;
    }
    if (input.wasPressed('KeyR')) {
      startMission(game.missionIndex);
      return;
    }

    const event = stepPlane(plane, input.state, dt, terrain, game.mission.gusts);
    audio.update(plane.throttle, plane.speed, plane.engineOn);
    checkRings();

    if (game.message && game.time > game.messageUntil) game.message = null;

    if (event === 'landed') {
      finishLanding();
      return;
    }
    if (event === 'crash') {
      endSortie(false, 'CRASHED', [
        `You hit the island at ${Math.round(plane.speed * 1.944)} kt.`,
        `Rings flown: ${game.nextRing}/${game.rings.length}. Score: ${game.score}`,
        'Press R to fly again, or pick another mission.',
      ]);
      return;
    }
    if (event === 'ditched') {
      endSortie(false, 'DITCHED IN THE SEA', [
        `The lagoon is not a runway.`,
        `Rings flown: ${game.nextRing}/${game.rings.length}. Score: ${game.score}`,
        'Press R to fly again, or pick another mission.',
      ]);
      return;
    }
    if (plane.fuel <= 0 && !plane.onGround) {
      showMessage('FUEL EMPTY — GLIDING', '#ff5d5d', 2);
    }
    if (game.timeLeft <= 0) {
      endSortie(false, 'OUT OF TIME', [
        `The clock ran out over the islands.`,
        `Rings flown: ${game.nextRing}/${game.rings.length}. Score: ${game.score}`,
        'Press R to fly again.',
      ]);
    }
  }

  function drawTitle(ctx, W, H) {
    // The title screen flies itself: a slow orbit over the islands behind the menu.
    const demoPlane = {
      x: Math.sin(game.time * 0.05) * 700,
      y: 190,
      z: Math.cos(game.time * 0.05) * 700,
      heading: game.time * 0.05 + Math.PI / 2,
      pitch: 0.04,
      roll: 0.25,
      speed: 60,
      throttle: 0.6,
      fuel: 100,
      damage: 0,
      gearDown: false,
      engineOn: true,
      verticalSpeed: 0,
      gust: 0,
      propAngle: game.time * 20,
      stalled: false,
      onGround: false,
    };
    renderFrame(renderer, {
      plane: demoPlane,
      terrain,
      clouds,
      rings: [],
      nextRing: 0,
      camera: 'chase',
      time: game.time,
    });
    ctx.fillStyle = 'rgba(8,14,24,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc93c';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('SKYCOURIER', W / 2, H * 0.22);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'italic 24px Georgia, serif';
    ctx.fillText('— Island Run —', W / 2, H * 0.22 + 38);
    ctx.font = '15px monospace';
    ctx.fillStyle = 'rgba(234,246,255,0.85)';
    ctx.fillText('A bush-plane courier over a living archipelago. Fly the rings. Mind the fuel. Grease the landing.', W / 2, H * 0.22 + 72);

    // Mission cards.
    const cardW = 300;
    const gap = 24;
    const total = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
    let x = (W - total) / 2;
    const y = H * 0.42;
    MISSIONS.forEach((m, i) => {
      ctx.fillStyle = i === game.missionIndex ? 'rgba(255,201,60,0.16)' : 'rgba(10,18,30,0.72)';
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, 150, 10);
      ctx.fill();
      ctx.strokeStyle = i === game.missionIndex ? '#ffc93c' : 'rgba(234,246,255,0.3)';
      ctx.lineWidth = i === game.missionIndex ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = '#ffc93c';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`[${m.key}]  ${m.name}`, x + cardW / 2, y + 30);
      ctx.fillStyle = '#eaf6ff';
      ctx.font = '13px monospace';
      ctx.fillText(m.tagline, x + cardW / 2, y + 56);
      ctx.fillStyle = 'rgba(234,246,255,0.75)';
      ctx.font = '11px monospace';
      wrapText(ctx, m.goal, x + cardW / 2, y + 82, cardW - 28, 15);
      ctx.fillStyle = 'rgba(234,246,255,0.55)';
      ctx.fillText(`FUEL ${m.fuel}%   LIMIT ${m.timeLimit}s`, x + cardW / 2, y + 132);
      x += cardW + gap;
    });
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '14px monospace';
    ctx.fillText('Press 1, 2 or 3 to pick a mission — or click a card.  Arrows / WASD fly, Shift throttle up, Ctrl down, G gear, C camera.', W / 2, H * 0.42 + 190);
    ctx.fillStyle = 'rgba(234,246,255,0.55)';
    ctx.font = '12px monospace';
    ctx.fillText('An original game by @budi-santika — no real places, planes or brands. Best with sound on.', W / 2, H * 0.42 + 216);
    ctx.textAlign = 'left';
  }

  function wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, ly);
        line = word;
        ly += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, cx, ly);
  }

  function drawBriefing(ctx, W, H) {
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, W, H);
    const m = game.mission;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc93c';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(m.name, W / 2, H * 0.3);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '16px monospace';
    wrapText(ctx, m.briefing, W / 2, H * 0.3 + 44, 640, 24);
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(234,246,255,0.7)';
    ctx.fillText('Arrows / WASD — pitch and bank      Shift / Ctrl — throttle      G — gear      C — camera      P — pause', W / 2, H * 0.3 + 150);
    ctx.fillStyle = '#7dff9b';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Press ENTER or click to take off', W / 2, H * 0.3 + 200);
    ctx.textAlign = 'left';
  }

  function drawPaused(ctx, W, H) {
    ctx.fillStyle = 'rgba(8,14,24,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText('PAUSED', W / 2, H * 0.45);
    ctx.font = '15px monospace';
    ctx.fillText('P — resume      R — restart sortie      1/2/3 — change mission', W / 2, H * 0.45 + 36);
    ctx.textAlign = 'left';
  }

  function drawDone(ctx, W, H) {
    // Keep the last frame of the flight behind the debrief.
    ctx.fillStyle = 'rgba(8,14,24,0.55)';
    ctx.fillRect(0, 0, W, H);
    const r = game.result;
    ctx.textAlign = 'center';
    ctx.fillStyle = r.won ? '#7dff9b' : '#ff5d5d';
    ctx.font = 'bold 38px Georgia, serif';
    ctx.fillText(r.title, W / 2, H * 0.36);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '16px monospace';
    r.lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, H * 0.36 + 40 + i * 28);
    });
    ctx.fillStyle = '#ffc93c';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('R — fly again      1/2/3 — another mission      Click a mission card on the title screen (Esc)', W / 2, H * 0.36 + 40 + r.lines.length * 28 + 30);
    ctx.textAlign = 'left';
  }

  function draw() {
    const ctx = renderer.ctx;
    const W = renderer.canvas.width;
    const H = renderer.canvas.height;
    if (game.screen === 'title') {
      game.time += 1 / 60;
      drawTitle(ctx, W, H);
      return;
    }
    if (game.screen === 'briefing') {
      drawBriefing(ctx, W, H);
      return;
    }
    renderFrame(renderer, {
      plane,
      terrain,
      clouds,
      rings: game.rings,
      nextRing: game.nextRing,
      camera: game.camera,
      time: game.time,
    });
    drawHud(ctx, W, H, {
      plane,
      mission: game.mission,
      rings: game.rings,
      nextRing: game.nextRing,
      score: game.score,
      timeLeft: game.timeLeft,
      message: game.message,
      messageColour: game.messageColour,
      camera: game.camera,
    });
    if (game.screen === 'paused') drawPaused(ctx, W, H);
    if (game.screen === 'done') drawDone(ctx, W, H);
  }

  function tick() {
    const dt = 1 / 60;
    if (game.screen === 'title') {
      const pick = input.missionPick();
      if (pick) {
        game.missionIndex = Number(pick) - 1;
        game.mission = MISSIONS[game.missionIndex];
        game.screen = 'briefing';
        audio.unlock();
        audio.click();
      } else if (input.wasPressed('Enter')) {
        game.screen = 'briefing';
        audio.unlock();
      }
    } else if (game.screen === 'briefing') {
      if (input.wasPressed('Enter') || input.wasPressed('Space')) {
        startMission(game.missionIndex);
      }
    } else if (game.screen === 'paused') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) game.screen = 'flying';
      if (input.wasPressed('KeyR')) startMission(game.missionIndex);
      const pick = input.missionPick();
      if (pick) startMission(Number(pick) - 1);
    } else if (game.screen === 'done') {
      if (input.wasPressed('KeyR')) startMission(game.missionIndex);
      if (input.wasPressed('Escape')) game.screen = 'title';
      const pick = input.missionPick();
      if (pick) startMission(Number(pick) - 1);
    } else {
      update(dt);
    }
    draw();
  }

  // Deterministic screenshot presets: place the plane and run the sim a fixed
  // number of frames, then freeze. Real renders of the game's own code.
  function applyShot(name) {
    game.frozen = false;
    if (name === 'cover') {
      startMission(0);
      plane.x = 0; plane.y = 135; plane.z = 980; plane.heading = 0;
      plane.pitch = 0.02; plane.roll = 0.12; plane.speed = 62; plane.throttle = 0.7;
      plane.fuel = 78;
      plane.onGround = false;
      game.rings[0].done = true;
      game.nextRing = 1;
      game.score = 512;
      game.timeLeft = 295;
      settle(100);
    } else if (name === 'rings') {
      startMission(0);
      plane.x = -200; plane.y = 112; plane.z = 300; plane.heading = -0.46;
      plane.pitch = 0.05; plane.roll = -0.25; plane.speed = 68; plane.throttle = 0.78;
      plane.fuel = 84;
      plane.onGround = false;
      game.rings[0].done = true;
      game.nextRing = 1;
      game.score = 512;
      game.timeLeft = 302;
      settle(25);
    } else if (name === 'landing') {
      startMission(1);
      plane.x = 6; plane.y = 34; plane.z = 700; plane.heading = 0;
      plane.pitch = -0.06; plane.roll = 0.02; plane.speed = 47; plane.throttle = 0.32;
      plane.gearDown = true;
      plane.fuel = 61;
      plane.onGround = false;
      game.rings[0].done = true;
      game.nextRing = 1;
      game.score = 500;
      game.timeLeft = 388;
      settle(80);
    } else if (name === 'cockpit') {
      startMission(2);
      game.camera = 'cockpit';
      plane.x = 320; plane.y = 210; plane.z = 420; plane.heading = -0.7;
      plane.pitch = 0.03; plane.roll = 0.18; plane.speed = 66; plane.throttle = 0.72;
      plane.fuel = 63;
      plane.onGround = false;
      game.rings[0].done = true;
      game.nextRing = 1;
      game.score = 1040;
      game.timeLeft = 311;
      settle(90);
    } else {
      return false;
    }
    game.frozen = true;
    return true;
  }

  // Advance the simulation a fixed number of frames with no input, so the
  // screenshot shows a settled, lived-in moment of flight.
  function settle(frames) {
    const idle = {
      pitchUp: false, pitchDown: false, rollLeft: false, rollRight: false,
      throttleUp: false, throttleDown: false, brake: false,
    };
    for (let i = 0; i < frames; i++) {
      game.time += 1 / 60;
      game.timeLeft -= 1 / 60;
      stepPlane(plane, idle, 1 / 60, terrain, game.mission.gusts);
    }
    draw();
  }

  return { game, tick, applyShot, startMission };
}
