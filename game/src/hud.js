// Skycourier — Island Run: the instruments.
// One job: every number and dial the pilot reads — altitude and speed tapes,
// the heading compass, fuel and throttle, the attitude ball, the mission card,
// the ring counter and the centre messages. Drawn crisp over the 3D view.

import { COLOURS, PLANE, RUNWAY } from './config.js';

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(10,18,30,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234,246,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function tape(ctx, x, y, w, h, value, unit, step, label, danger) {
  panel(ctx, x, y, w, h, 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const pxPerUnit = h / (step * 6);
  const centre = y + h / 2;
  ctx.font = `11px monospace`;
  ctx.textAlign = 'left';
  const base = Math.floor(value / step) * step;
  for (let v = base - step * 3; v <= base + step * 4; v += step) {
    const ty = centre - (v - value) * pxPerUnit;
    if (ty < y - 4 || ty > y + h + 4) continue;
    ctx.strokeStyle = 'rgba(234,246,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(x + 6, ty);
    ctx.lineTo(x + 16, ty);
    ctx.stroke();
    ctx.fillStyle = 'rgba(234,246,255,0.75)';
    ctx.fillText(String(v), x + 20, ty + 4);
  }
  ctx.restore();
  // Centre readout.
  ctx.fillStyle = danger ? COLOURS.hudRed : COLOURS.hudInk;
  ctx.fillRect(x - 4, centre - 13, w + 8, 26);
  ctx.fillStyle = '#0a1220';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(value)} ${unit}`, x + w / 2, centre + 5);
  ctx.fillStyle = 'rgba(234,246,255,0.6)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(label === 'ALTITUDE' ? 'ALT' : 'SPD', x + w - 6, y + 12);
  ctx.textAlign = 'left';
}

function compassTape(ctx, cx, y, w, headingDeg) {
  panel(ctx, cx - w / 2, y, w, 34, 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y, w, 34);
  ctx.clip();
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  const pxPerDeg = w / 90;
  const centre = cx;
  const start = Math.floor((headingDeg - 45) / 5) * 5;
  for (let d = start; d <= headingDeg + 45; d += 5) {
    const dd = ((d % 360) + 360) % 360;
    const dx = centre + (dd - headingDeg) * pxPerDeg;
    // Wrap the tape around the 0/360 seam.
    let wrapped = dx;
    if (wrapped < cx - w / 2) wrapped += 360 * pxPerDeg;
    if (wrapped > cx + w / 2) wrapped -= 360 * pxPerDeg;
    if (wrapped < cx - w / 2 || wrapped > cx + w / 2) continue;
    const major = dd % 30 === 0;
    ctx.strokeStyle = major ? 'rgba(234,246,255,0.8)' : 'rgba(234,246,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(wrapped, y + (major ? 6 : 12));
    ctx.lineTo(wrapped, y + 18);
    ctx.stroke();
    if (major) {
      const name = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] || String(dd / 10).padStart(2, '0');
      ctx.fillStyle = COLOURS.hudInk;
      ctx.fillText(name, wrapped, y + 30);
    }
  }
  ctx.restore();
  // Centre caret and digital heading.
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y);
  ctx.lineTo(cx + 6, y);
  ctx.lineTo(cx, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOURS.hudInk;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y + 48);
}

function attitudeBall(ctx, cx, cy, r, pitch, roll) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pitchPx = pitch * r * 1.6;
  // Sky above the horizon line, ground below.
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (const off of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -pitchPx + off * r);
    ctx.lineTo(r * 0.4, -pitchPx + off * r);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings and bezel.
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.62, cy);
  ctx.lineTo(cx - r * 0.18, cy);
  ctx.moveTo(cx + r * 0.18, cy);
  ctx.lineTo(cx + r * 0.62, cy);
  ctx.stroke();
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234,246,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, colour, label) {
  ctx.fillStyle = 'rgba(10,18,30,0.7)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, Math.max(0, (w - 4) * frac), h - 4, 3);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudInk;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + h / 2 + 4);
}

// state: { plane, mission, rings, nextRing, score, timeLeft, message, camera }
export function drawHud(ctx, W, H, state) {
  const p = state.plane;
  const headingDeg = (((p.heading * 180) / Math.PI) % 360 + 360) % 360;
  const alt = Math.max(0, p.y);
  const speedKts = p.speed * 1.944;

  // Left: altitude tape. Right: speed tape.
  tape(ctx, 16, 70, 92, 190, alt, 'm', 10, 'ALTITUDE', alt < 12 && !p.onGround);
  tape(ctx, W - 108, 70, 92, 190, speedKts, 'kt', 10, 'AIRSPEED', p.stalled);

  // Top centre: heading compass.
  compassTape(ctx, W / 2, 14, 340, headingDeg);

  // Bottom left: fuel, throttle, gear.
  const fuelColour = p.fuel < 20 ? COLOURS.hudRed : p.fuel < 45 ? COLOURS.hudAmber : COLOURS.hudGreen;
  panel(ctx, 16, H - 118, 240, 102);
  ctx.fillStyle = COLOURS.hudInk;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', 28, H - 96);
  bar(ctx, 28, H - 88, 216, 16, p.fuel / 100, fuelColour, `${Math.round(p.fuel)}%`);
  ctx.fillText('THROTTLE', 28, H - 58);
  bar(ctx, 28, H - 50, 216, 16, p.throttle, p.engineOn ? '#7fb2e8' : '#555', `${Math.round(p.throttle * 100)}%`);
  ctx.fillStyle = p.gearDown ? COLOURS.hudGreen : 'rgba(234,246,255,0.55)';
  ctx.fillText(p.gearDown ? 'GEAR DOWN' : 'GEAR UP  (G)', 28, H - 26);

  // Bottom right: attitude ball + vertical speed.
  panel(ctx, W - 256, H - 118, 240, 102);
  attitudeBall(ctx, W - 196, H - 67, 34, p.pitch, p.roll);
  ctx.fillStyle = COLOURS.hudInk;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ATTITUDE', W - 140, H - 96);
  const vs = p.verticalSpeed;
  ctx.fillStyle = vs < -6 ? COLOURS.hudRed : COLOURS.hudInk;
  ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`, W - 140, H - 74);
  ctx.fillStyle = COLOURS.hudInk;
  ctx.fillText(`HDG ${String(Math.round(headingDeg)).padStart(3, '0')}°`, W - 140, H - 52);
  ctx.fillText(p.stalled ? 'STALL!' : p.onGround ? 'ON GROUND' : 'AIRBORNE', W - 140, H - 30);

  // Top left under the tape: mission card.
  panel(ctx, 16, 14, 300, 46);
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(state.mission.name, 28, 32);
  ctx.fillStyle = 'rgba(234,246,255,0.85)';
  ctx.font = '11px monospace';
  ctx.fillText(state.mission.goal, 28, 48);

  // Top right: score, rings, clock.
  panel(ctx, W - 316, 14, 300, 46);
  ctx.fillStyle = COLOURS.hudInk;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${state.score}`, W - 28, 32);
  const ringText = `RINGS ${state.nextRing}/${state.rings.length}`;
  const timeText = `T-${Math.max(0, Math.ceil(state.timeLeft))}s`;
  ctx.font = '11px monospace';
  ctx.fillStyle = state.timeLeft < 60 ? COLOURS.hudRed : 'rgba(234,246,255,0.85)';
  ctx.fillText(`${ringText}   ${timeText}`, W - 28, 48);
  ctx.textAlign = 'left';

  // Next-ring bearing arrow under the compass.
  if (state.nextRing < state.rings.length && !p.onGround) {
    const ring = state.rings[state.nextRing];
    const dx = ring.x - p.x;
    const dz = ring.z - p.z;
    const bearing = Math.atan2(dx, -dz); // rad, same frame as heading
    let rel = bearing - p.heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    const dist = Math.hypot(dx, dz);
    const ax = W / 2 + Math.sin(rel) * 150;
    const ay = 100;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rel);
    ctx.fillStyle = COLOURS.ringGold;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 6);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const ringLabel = `NEXT RING ${Math.round(dist)}m`;
    const rw = ctx.measureText(ringLabel).width;
    ctx.fillStyle = 'rgba(10,18,30,0.7)';
    ctx.fillRect(W / 2 - rw / 2 - 10, 116, rw + 20, 20);
    ctx.fillStyle = COLOURS.hudInk;
    ctx.fillText(ringLabel, W / 2, 130);
    ctx.textAlign = 'left';
  }

  // Centre message (ring collected, warnings, results).
  if (state.message) {
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,18,30,0.75)';
    const tw = ctx.measureText(state.message).width;
    ctx.fillRect(W / 2 - tw / 2 - 18, H * 0.3 - 26, tw + 36, 44);
    ctx.fillStyle = state.messageColour || COLOURS.hudInk;
    ctx.fillText(state.message, W / 2, H * 0.3 + 5);
    ctx.textAlign = 'left';
  }

  // Damage flash and low-fuel warning.
  if (p.damage > 0 && p.damage < 100) {
    ctx.fillStyle = 'rgba(255,60,60,0.12)';
    ctx.fillRect(0, 0, W, H);
  }
  if (p.fuel < 15 && p.engineOn) {
    ctx.fillStyle = COLOURS.hudRed;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', W / 2, H - 132);
    ctx.textAlign = 'left';
  }
  // Camera hint.
  ctx.fillStyle = 'rgba(234,246,255,0.5)';
  ctx.font = '11px monospace';
  ctx.fillText(
    `${state.camera === 'cockpit' ? 'COCKPIT' : 'CHASE'} VIEW  (C)    PAUSE (P)    MUTE (M)`,
    W / 2 - 170,
    H - 14,
  );
}
