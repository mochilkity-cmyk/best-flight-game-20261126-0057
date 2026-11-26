// Skycourier — Island Run: keyboard and mouse.
// One job: read the pilot's hands and hand the game a clean input state.
// Arrow keys / WASD fly the plane, Shift/Ctrl work the throttle, G drops the
// gear, C swaps the camera, P pauses, M mutes, R restarts, Space brakes.
// The mouse steers too: hold the left button and pull toward where you fly.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, active: false };

  const state = {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    throttleUp: false,
    throttleDown: false,
    brake: false,
  };

  function refresh() {
    const k = keys;
    state.pitchUp = k.has('ArrowUp') || k.has('KeyW');
    state.pitchDown = k.has('ArrowDown') || k.has('KeyS');
    state.rollLeft = k.has('ArrowLeft') || k.has('KeyA');
    state.rollRight = k.has('ArrowRight') || k.has('KeyD');
    state.throttleUp = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE');
    state.throttleDown = k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyQ');
    state.brake = k.has('Space');
    // Mouse steering blends in: pull left/right to bank, up/down to pitch.
    if (mouse.down && mouse.active) {
      const dx = (mouse.x / canvas.width - 0.5) * 2;
      const dy = (mouse.y / canvas.height - 0.5) * 2;
      if (dx < -0.08) state.rollLeft = true;
      if (dx > 0.08) state.rollRight = true;
      if (dy < -0.12) state.pitchUp = true;
      if (dy > 0.12) state.pitchDown = true;
    }
  }

  // Edge-triggered keys: the game polls these once per frame.
  const pressed = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    refresh();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    refresh();
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.active = true;
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
    refresh();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
    refresh();
  });
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
    if (mouse.down) refresh();
  });

  return {
    state,
    // True once after the key goes down, until the game reads it.
    wasPressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    // Title-screen mission pick: '1', '2' or '3'.
    missionPick() {
      for (const code of ['Digit1', 'Digit2', 'Digit3']) {
        if (pressed.has(code)) {
          pressed.delete(code);
          return code.slice(-1);
        }
      }
      return null;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
