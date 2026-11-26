// Skycourier — Island Run: the aircraft.
// One job: how the plane flies (throttle, lift, stall, bank, gusts, fuel, damage)
// and how it looks (a vector-drawn bush plane, banking with the turn).

import { PLANE, RUNWAY, WORLD } from './config.js';

export function createPlane(terrain) {
  return {
    // Position and attitude.
    x: 0,
    y: 150,
    z: 900,
    heading: 0, // rad, 0 = north (-z), grows clockwise
    pitch: 0, // rad, positive = nose up
    roll: 0, // rad, positive = bank right
    speed: 55, // m/s
    throttle: 0.65,
    fuel: 100,
    damage: 0, // 0..100; 100 = wrecked
    gearDown: false,
    engineOn: true,
    verticalSpeed: 0,
    gust: 0, // sideways wind push, m/s, set by the game
    propAngle: 0,
    // Derived each step, read by the HUD and the renderer.
    stalled: false,
    onGround: false,
  };
}

export function resetPlane(plane, mission, terrain) {
  plane.x = 0;
  plane.y = mission.needsLanding ? RUNWAY.height + 0.5 : 150;
  plane.z = mission.needsLanding ? 700 : 900;
  plane.heading = 0;
  plane.pitch = 0;
  plane.roll = 0;
  plane.speed = mission.needsLanding ? 0 : 55;
  plane.throttle = mission.needsLanding ? 0 : 0.65;
  plane.fuel = mission.fuel;
  plane.damage = 0;
  plane.gearDown = false;
  plane.engineOn = true;
  plane.verticalSpeed = 0;
  plane.gust = 0;
  plane.onGround = mission.needsLanding;
  plane.stalled = false;
}

// input: { pitchUp, pitchDown, rollLeft, rollRight, throttleUp, throttleDown, brake }
// dt in seconds. Returns an event string: 'stall' | 'crash' | 'landed' | 'ditched' | null.
export function stepPlane(plane, input, dt, terrain, gustsOn) {
  const prevY = plane.y;

  // --- Throttle and fuel ---
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.6);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.6);
  if (plane.fuel <= 0) {
    plane.throttle = 0;
    plane.engineOn = false;
  }
  const burn = plane.engineOn
    ? PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * plane.throttle
    : 0;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);

  // --- Speed: thrust minus drag, plus a push from a nose-down attitude ---
  const thrust = plane.engineOn ? plane.throttle * 26 : 0;
  const drag = 0.0032 * plane.speed * plane.speed + (plane.gearDown ? 2.2 : 0);
  plane.speed += (thrust - drag - Math.sin(plane.pitch) * 9.8 * 0.4) * dt;
  if (plane.onGround) {
    // Rolling resistance and braking on the strip.
    plane.speed -= (input.brake ? 14 : 3.5) * dt;
    if (plane.speed < 0) plane.speed = 0;
  }
  plane.speed = Math.max(0, Math.min(PLANE.maxSpeed + 12, plane.speed));

  // --- Stall: below minimum speed the wing quits and the nose drops ---
  plane.stalled = !plane.onGround && plane.speed < PLANE.minSpeed;
  if (plane.stalled) plane.pitch -= dt * 0.5;

  // --- Attitude from the stick ---
  const targetRoll =
    (input.rollRight ? 1 : 0) * PLANE.maxBank - (input.rollLeft ? 1 : 0) * PLANE.maxBank;
  plane.roll += (targetRoll - plane.roll) * Math.min(1, dt * 3.2);
  const pitchInput = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const targetPitch = pitchInput * PLANE.maxPitch * (plane.stalled ? 0.4 : 1);
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 2.6);

  // --- Heading follows the bank; a banked turn needs speed ---
  const turnAuthority = Math.min(1, plane.speed / PLANE.cruiseSpeed);
  plane.heading += Math.sin(plane.roll) * PLANE.turnRate * turnAuthority * dt;

  // --- Gusts (Storm Courier): a slow sideways shove, felt in the heading ---
  if (gustsOn && !plane.onGround) {
    plane.gust = Math.sin(plane.z * 0.004 + plane.x * 0.002) * 6;
    plane.x += plane.gust * dt * 0.4;
  } else {
    plane.gust = 0;
  }

  // --- Vertical speed: lift from speed and pitch, gravity always pulling ---
  // Sink grows as the throttle comes back: idle power means a real descent,
  // full power nearly holds altitude hands-off.
  const lift =
    plane.onGround || plane.speed < 4
      ? 0
      : Math.sin(plane.pitch) * plane.speed * 0.55 +
        (plane.engineOn ? plane.throttle * PLANE.climbRate * 0.45 : 0);
  const sink = plane.onGround
    ? 0
    : plane.engineOn
      ? 2 + (1 - plane.throttle) * 6
      : 8;
  plane.verticalSpeed = lift - sink;
  plane.y += plane.verticalSpeed * dt;

  // --- Move forward along the heading ---
  const forward = plane.onGround ? plane.speed : plane.speed * Math.cos(plane.pitch);
  plane.x += Math.sin(plane.heading) * forward * dt;
  plane.z -= Math.cos(plane.heading) * forward * dt;

  // --- World edge: turn back with a gentle nudge, never a wall ---
  const edge = WORLD.size / 2 - 60;
  if (Math.abs(plane.x) > edge || Math.abs(plane.z) > edge) {
    plane.heading += Math.PI * dt * 0.4; // slow U-turn back toward the islands
  }

  plane.propAngle += dt * (plane.engineOn ? 14 + plane.throttle * 30 : 2);

  // --- Ground contact ---
  const ground = terrain.heightAt(plane.x, plane.z);
  if (plane.y <= ground) {
    plane.y = ground;
    if (plane.onGround) return null;
    const overRunway = terrain.onRunway(plane.x, plane.z);
    const sinkAtTouch = -plane.verticalSpeed;
    const gentle =
      overRunway &&
      plane.speed <= PLANE.gearSpeedMax &&
      sinkAtTouch <= PLANE.touchdownSinkMax &&
      Math.abs(plane.roll) < 0.25;
    if (gentle) {
      plane.onGround = true;
      plane.pitch = 0;
      plane.roll = 0;
      plane.verticalSpeed = 0;
      return 'landed';
    }
    if (ground <= 0.6) return 'ditched'; // water
    plane.damage = 100;
    return 'crash';
  }
  return null;
}

// Draw the bush plane as seen from a chase camera: centred, banking with roll,
// pitching a touch with pitch, propeller spinning. ctx is already translated to
// the plane's screen position; s is the scale in pixels.
export function drawPlane(ctx, plane, s, time) {
  ctx.save();
  ctx.rotate(plane.roll * 0.9);
  ctx.translate(0, -plane.pitch * s * 0.35);

  // Soft shadow on the ground is drawn by the renderer, not here.
  // Tailplane.
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.moveTo(-0.62 * s, 0.42 * s);
  ctx.lineTo(0.62 * s, 0.42 * s);
  ctx.lineTo(0.34 * s, 0.62 * s);
  ctx.lineTo(-0.34 * s, 0.62 * s);
  ctx.closePath();
  ctx.fill();
  // Fin.
  ctx.beginPath();
  ctx.moveTo(0, 0.34 * s);
  ctx.lineTo(0.16 * s, 0.78 * s);
  ctx.lineTo(-0.02 * s, 0.82 * s);
  ctx.lineTo(-0.12 * s, 0.5 * s);
  ctx.closePath();
  ctx.fill();
  // Main wing, slightly swept, with sunlit top.
  const wingGrad = ctx.createLinearGradient(0, -0.25 * s, 0, 0.3 * s);
  wingGrad.addColorStop(0, '#f6e8c8');
  wingGrad.addColorStop(1, '#d9a441');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(-1.5 * s, 0.1 * s);
  ctx.lineTo(-1.28 * s, -0.28 * s);
  ctx.lineTo(1.28 * s, -0.28 * s);
  ctx.lineTo(1.5 * s, 0.1 * s);
  ctx.lineTo(0.9 * s, 0.34 * s);
  ctx.lineTo(-0.9 * s, 0.34 * s);
  ctx.closePath();
  ctx.fill();
  // Fuselage: cream body, red cheatline, lit windows.
  const bodyGrad = ctx.createLinearGradient(0, -0.5 * s, 0, 0.5 * s);
  bodyGrad.addColorStop(0, '#fdf6e3');
  bodyGrad.addColorStop(0.55, '#f2d98c');
  bodyGrad.addColorStop(1, '#c98f2f');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -0.95 * s);
  ctx.quadraticCurveTo(0.34 * s, -0.5 * s, 0.3 * s, 0.1 * s);
  ctx.quadraticCurveTo(0.26 * s, 0.62 * s, 0, 0.86 * s);
  ctx.quadraticCurveTo(-0.26 * s, 0.62 * s, -0.3 * s, 0.1 * s);
  ctx.quadraticCurveTo(-0.34 * s, -0.5 * s, 0, -0.95 * s);
  ctx.fill();
  ctx.fillStyle = '#c94f2e';
  ctx.fillRect(-0.3 * s, 0.02 * s, 0.6 * s, 0.07 * s);
  // Windscreen, lit from the sky.
  ctx.fillStyle = '#9fd8ef';
  ctx.beginPath();
  ctx.moveTo(-0.2 * s, -0.62 * s);
  ctx.lineTo(0.2 * s, -0.62 * s);
  ctx.lineTo(0.14 * s, -0.32 * s);
  ctx.lineTo(-0.14 * s, -0.32 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.moveTo(-0.16 * s, -0.58 * s);
  ctx.lineTo(-0.02 * s, -0.58 * s);
  ctx.lineTo(-0.1 * s, -0.38 * s);
  ctx.lineTo(-0.18 * s, -0.38 * s);
  ctx.closePath();
  ctx.fill();
  // Registration on the fin, tiny but there.
  ctx.fillStyle = '#fdf6e3';
  ctx.font = `bold ${Math.max(6, s * 0.11)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('SK-26', 0, 0.68 * s);
  // Propeller: a spinning translucent disc with two blades.
  ctx.save();
  ctx.translate(0, -0.95 * s);
  ctx.rotate(plane.propAngle);
  ctx.fillStyle = 'rgba(40,40,46,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.08 * s, 0.52 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.52 * s, 0.08 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2c2c30';
  ctx.beginPath();
  ctx.arc(0, -0.95 * s, 0.09 * s, 0, Math.PI * 2);
  ctx.fill();
  // Navigation lights: red port, green starboard, blinking white tail.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-1.5 * s, 0.08 * s, 0.05 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.beginPath();
  ctx.arc(1.5 * s, 0.08 * s, 0.05 * s, 0, Math.PI * 2);
  ctx.fill();
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0.86 * s, 0.06 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
