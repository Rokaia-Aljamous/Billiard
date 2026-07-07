let ctx: AudioContext | null = null;

const getCtx = () => {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};

export const playCollisionSound = (magnitude: number) => {
  try {
    const c = getCtx();
    const gain = c.createGain();
    gain.connect(c.destination);

    const osc = c.createOscillator();
    osc.type = "sine";
    const freq = 600 + Math.min(magnitude * 80, 800);
    osc.frequency.setValueAtTime(freq, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.06);

    const vol = Math.min(0.08 + magnitude * 0.008, 0.35);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);

    osc.connect(gain);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.08);
  } catch {
    // audio unavailable
  }
};

export const playCushionSound = (speed: number) => {
  try {
    const c = getCtx();
    const gain = c.createGain();
    gain.connect(c.destination);

    const osc = c.createOscillator();
    osc.type = "triangle";
    const freq = 200 + Math.min(speed * 60, 500);
    osc.frequency.setValueAtTime(freq, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.08);

    const vol = Math.min(0.12 + speed * 0.015, 0.5);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);

    osc.connect(gain);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.08);
  } catch {
    // audio unavailable
  }
};
