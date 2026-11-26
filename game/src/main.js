// Skycourier — Island Run: boot.
// One job: size the canvas, start the game loop at a fixed 60 Hz step, and
// honour ?shot=<cover|rings|landing|cockpit> for deterministic screenshots:
// the preset settles the flight, freezes the frame, and stops the loop.

import { createGame } from './game.js';

const canvas = document.getElementById('game');
const WIDTH = 1280;
const HEIGHT = 800;

function fitCanvas() {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
}

fitCanvas();

const { game, tick, applyShot } = createGame(canvas);

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: one settled frame, then stop. No input, no clock.
  applyShot(shot);
  document.title = `Skycourier — ${shot}`;
} else {
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP) {
      tick();
      acc -= STEP;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.addEventListener('resize', fitCanvas);
}
