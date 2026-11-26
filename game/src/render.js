// Skycourier — Island Run: the view.
// One job: turn the world into pixels — sky, sun, clouds, the voxel terrain,
// the runway, the rings, the plane's shadow, and the chase or cockpit camera.
// The terrain is rendered Comanche-style: one ray per screen column, stepping
// out from the camera and painting each column down to the last height seen.

import { WORLD, RUNWAY, COLOURS } from './config.js';
import { groundColour } from './terrain.js';
import { makeNoise2D } from './random.js';
import { drawPlane } from './plane.js';

const VW = 640; // voxel buffer width
const VH = 360; // voxel buffer height
const FOV = 1.35; // rad, horizontal field of view
const FOCAL = VW / 2 / Math.tan(FOV / 2);
const RING_RADIUS = 26; // metres
const SUN_AZIMUTH = 0.9; // rad, where the sun sits in the world

const fbm = makeNoise2D(20261126 + 5);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = VW;
  buf.height = VH;
  const bctx = buf.getContext('2d');
  const maxY = new Float32Array(VW);
  return { canvas, ctx, buf, bctx, maxY };
}

// Project a world point into voxel-buffer screen space.
// Returns null when behind the camera.
function project(cam, x, y, z) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  const fwd = dx * Math.sin(cam.heading) - dz * Math.cos(cam.heading);
  if (fwd < 4) return null;
  const right = dx * Math.cos(cam.heading) + dz * Math.sin(cam.heading);
  const sx = VW / 2 + (right / fwd) * FOCAL;
  const sy = cam.horizon - ((y - cam.y) / fwd) * FOCAL;
  return { x: sx, y: sy, fwd, scale: FOCAL / fwd };
}

function drawSky(bctx, cam) {
  const g = bctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, COLOURS.skyTop);
  g.addColorStop(0.55, COLOURS.skyMid);
  g.addColorStop(0.8, COLOURS.skyHorizon);
  g.addColorStop(1, COLOURS.skyHorizon);
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, VW, VH);
  // Sun: fixed in the world, so it swings across the sky as you turn.
  const rel = SUN_AZIMUTH - cam.heading;
  const sunX = VW / 2 + Math.tan(rel) * FOCAL * 0.9;
  const sunY = cam.horizon - 150;
  if (sunX > -80 && sunX < VW + 80) {
    const glow = bctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,226,140,0.55)');
    glow.addColorStop(1, 'rgba(255,226,140,0)');
    bctx.fillStyle = glow;
    bctx.fillRect(sunX - 70, sunY - 70, 140, 140);
    bctx.fillStyle = '#fff6cf';
    bctx.beginPath();
    bctx.arc(sunX, sunY, 16, 0, Math.PI * 2);
    bctx.fill();
  }
}

function drawClouds(bctx, cam, clouds) {
  for (const c of clouds) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p || p.x < -200 || p.x > VW + 200) continue;
    const r = c.r * p.scale;
    if (r < 2) continue;
    bctx.fillStyle = `rgba(255,255,255,${c.a})`;
    bctx.beginPath();
    bctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.beginPath();
    bctx.ellipse(p.x - r * 0.5, p.y + r * 0.06, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.beginPath();
    bctx.ellipse(p.x + r * 0.55, p.y + r * 0.05, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
    bctx.fill();
  }
}

function drawTerrain(bctx, cam, terrain, maxY) {
  maxY.fill(VH);
  const horizon = cam.horizon;
  for (let col = 0; col < VW; col++) {
    const offset = (col / VW - 0.5) * FOV;
    const yaw = cam.heading + offset;
    const dirX = Math.sin(yaw);
    const dirZ = -Math.cos(yaw);
    const cosOff = Math.cos(offset);
    let z = 10;
    let top = VH;
    while (z < WORLD.far) {
      const wx = cam.x + dirX * z;
      const wz = cam.z + dirZ * z;
      if (Math.abs(wx) > 2050 || Math.abs(wz) > 2050) {
        z += 24;
        continue;
      }
      const h = terrain.heightAt(wx, wz);
      const zc = z * cosOff;
      const sy = horizon - ((h - cam.y) / zc) * FOCAL;
      if (sy < top) {
        // Colour this strip of ground, with the runway drawn in.
        let r;
        let g;
        let b;
        if (terrain.onRunway(wx, wz)) {
          const dash = Math.abs(wx) < 1.6 && ((wz % 44) + 44) % 44 < 22;
          const edge = Math.abs(Math.abs(wx) - RUNWAY.halfWidth) < 1.2;
          if (dash || edge) {
            r = 242; g = 242; b = 232;
          } else {
            r = 60; g = 63; b = 69;
          }
        } else {
          [r, g, b] = groundColour(h, wx, wz, fbm);
        }
        // Distance fog toward a hazy blue, never white.
        const fog = Math.min(0.5, z / WORLD.far);
        r = Math.round(r + (150 - r) * fog);
        g = Math.round(g + (190 - g) * fog);
        b = Math.round(b + (225 - b) * fog);
        bctx.fillStyle = `rgb(${r},${g},${b})`;
        const y0 = Math.max(0, Math.floor(sy));
        bctx.fillRect(col, y0, 1, Math.ceil(top) - y0);
        top = sy;
      }
      z += Math.max(2, z * 0.045);
    }
  }
}

function drawRing(bctx, cam, ring, isNext, time) {
  const p = project(cam, ring.x, ring.y, ring.z);
  if (!p) return;
  const r = RING_RADIUS * p.scale;
  if (r < 1.5 || p.x < -r || p.x > VW + r) return;
  const passed = ring.done;
  // A light pillar marks the next ring from far away.
  if (isNext && p.fwd > 120) {
    const base = project(cam, ring.x, 0, ring.z);
    if (base) {
      const grad = bctx.createLinearGradient(0, p.y, 0, base.y);
      grad.addColorStop(0, 'rgba(255,201,60,0.28)');
      grad.addColorStop(1, 'rgba(255,201,60,0)');
      bctx.fillStyle = grad;
      bctx.fillRect(p.x - 3, p.y, 6, base.y - p.y);
    }
  }
  const pulse = isNext ? 1 + Math.sin(time * 4) * 0.06 : 1;
  const rr = r * pulse;
  bctx.lineWidth = Math.max(2, rr * 0.16);
  if (passed) {
    bctx.strokeStyle = 'rgba(125,255,155,0.85)';
  } else if (isNext) {
    bctx.strokeStyle = COLOURS.ringGold;
    bctx.shadowColor = COLOURS.ringGold;
    bctx.shadowBlur = 14;
  } else {
    bctx.strokeStyle = 'rgba(255,201,60,0.45)';
  }
  bctx.beginPath();
  bctx.ellipse(p.x, p.y, rr, rr * 0.92, 0, 0, Math.PI * 2);
  bctx.stroke();
  bctx.shadowBlur = 0;
  bctx.lineWidth = Math.max(1, rr * 0.05);
  bctx.strokeStyle = 'rgba(60,40,0,0.6)';
  bctx.beginPath();
  bctx.ellipse(p.x, p.y, rr * 0.84, rr * 0.77, 0, 0, Math.PI * 2);
  bctx.stroke();
}

function drawShadow(bctx, cam, plane, terrain) {
  const ground = terrain.heightAt(plane.x, plane.z);
  if (plane.y - ground > 260) return;
  const p = project(cam, plane.x, ground + 0.6, plane.z);
  if (!p) return;
  const s = Math.max(2, 34 * p.scale * (1 - (plane.y - ground) / 300));
  bctx.fillStyle = 'rgba(10,20,30,0.3)';
  bctx.beginPath();
  bctx.ellipse(p.x, p.y, s, s * 0.3, 0, 0, Math.PI * 2);
  bctx.fill();
}

// state: { plane, terrain, clouds, rings, nextRing, camera, time }
// camera: 'chase' | 'cockpit'
export function renderFrame(renderer, state) {
  const { ctx, buf, bctx, maxY } = renderer;
  const { plane, terrain, clouds } = state;
  const W = renderer.canvas.width;
  const H = renderer.canvas.height;

  const cam = {
    heading: plane.heading,
    y: 0,
    x: 0,
    z: 0,
    horizon: 0,
  };
  if (state.camera === 'cockpit') {
    cam.x = plane.x;
    cam.y = plane.y + 1.2;
    cam.z = plane.z;
    cam.horizon = VH / 2 + plane.pitch * FOCAL;
  } else {
    // Chase camera: 16 m behind, 5 m above, looking slightly down the nose.
    cam.x = plane.x - Math.sin(plane.heading) * 16;
    cam.y = plane.y + 5;
    cam.z = plane.z + Math.cos(plane.heading) * 16;
    cam.horizon = VH / 2 + (plane.pitch * 0.55 - 0.02) * FOCAL;
  }

  drawSky(bctx, cam);
  drawClouds(bctx, cam, clouds);
  drawTerrain(bctx, cam, terrain, maxY);
  drawShadow(bctx, cam, plane, terrain);
  for (let i = 0; i < state.rings.length; i++) {
    drawRing(bctx, cam, state.rings[i], i === state.nextRing, state.time);
  }

  // Scale the voxel view up to the full canvas.
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, W, H);

  if (state.camera === 'chase') {
    // The aircraft, big in frame, banking with the turn.
    ctx.save();
    ctx.translate(W / 2, H * 0.66);
    drawPlane(ctx, plane, W * 0.075, state.time);
    ctx.restore();
  } else {
    drawCockpitFrame(ctx, W, H, plane);
  }
}

function drawCockpitFrame(ctx, W, H, plane) {
  // Glareshield: a dark dash across the bottom, curved like a real panel.
  const g = ctx.createLinearGradient(0, H * 0.72, 0, H);
  g.addColorStop(0, '#232a33');
  g.addColorStop(0.25, '#171c22');
  g.addColorStop(1, '#0b0e12');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.86);
  ctx.quadraticCurveTo(W * 0.5, H * 0.68, W, H * 0.86);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  // Windscreen pillars.
  ctx.fillStyle = '#10141a';
  ctx.beginPath();
  ctx.moveTo(W * 0.16, H * 0.78);
  ctx.lineTo(W * 0.2, H * 0.2);
  ctx.lineTo(W * 0.235, H * 0.2);
  ctx.lineTo(W * 0.2, H * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.84, H * 0.78);
  ctx.lineTo(W * 0.8, H * 0.2);
  ctx.lineTo(W * 0.765, H * 0.2);
  ctx.lineTo(W * 0.8, H * 0.8);
  ctx.closePath();
  ctx.fill();
  // Compass strip on the glareshield, lit.
  ctx.fillStyle = 'rgba(234,246,255,0.9)';
  ctx.font = `bold ${Math.round(H * 0.02)}px monospace`;
  ctx.textAlign = 'center';
  const hdg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
  ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, W / 2, H * 0.93);
}
