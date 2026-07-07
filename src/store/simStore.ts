import { create } from "zustand";
import {
  Ball,
  Vec3,
  PocketId,
  angularMomentum,
  kineticEnergy,
  momentum,
  rotationalEnergy,
  v,
  vlen,
  angleBetween,
} from "@/physics/types";
import {
  BallForces,
  World,
  applyCue,
  defaultWorld,
  detectPocketing,
  resolveCollision,
  stepBall,
  collisionAngle,
} from "@/physics/engine";
import { playCollisionSound, playCushionSound } from "@/lib/audio";

export type GameMode = "single" | "rotation" | "collision" | "cushion" | "jump" | "8ball" | "9ball" | "snooker" | "carom";

export type CameraMode = "orbit" | "top" | "side" | "follow" | "analysis";

export interface VectorToggles {
  gravity: boolean;
  normal: boolean;
  friction: boolean;
  velocity: boolean;
  acceleration: boolean;
  momentum: boolean;
  omega: boolean;
  impulse: boolean;
}

export type ShotPhase = "idle" | "pullback" | "impact" | "fired";

export interface CollisionEvent {
  id: number;
  pos: Vec3;
  magnitude: number;
  normal: Vec3;
  bornAt: number;
  angleDeg: number;
}

export interface PocketEvent {
  id: number;
  ballId: number;
  pocketId: PocketId;
  time: number;
}

export interface SamplePoint {
  t: number;
  speed: number;
  accel: number;
  momentum: number;
  omega: number;
  energy: number;
  totalEnergy: number;
  energyLost: number;
  totalMomentum: number;
  totalAngularMomentum: number;
}

interface ControlsState {
  mass: number;
  radius: number;
  muKinetic: number;
  muRolling: number;
  restitution: number;
  initialSpeed: number;
  initialOmega: number;
  spinType: "top" | "back" | "side" | "masse" | "swerve" | "none";
  impactForce: number;
  impactAngle: number;
}

export interface SystemStats {
  totalEnergy: number;
  totalMomentum: number;
  totalAngularMomentum: number;
  initialTotalEnergy: number;
  energyLost: number;
  activeBalls: number;
  pocketedCount: number;
}

interface SimState {
  mode: GameMode;
  world: World;
  balls: Ball[];
  forces: Record<number, BallForces>;
  toggles: VectorToggles;
  controls: ControlsState;
  running: boolean;
  time: number;
  samples: SamplePoint[];
  trail: Vec3[];
  predicted: Vec3[];
  collisions: CollisionEvent[];
  pocketEvents: PocketEvent[];
  cameraMode: CameraMode;
  showTrail: boolean;
  showPredicted: boolean;
  showLabels: boolean;
  aimAngle: number;
  cueElevation: number;
  shotPhase: ShotPhase;
  systemStats: SystemStats;
  initialTotalEnergy: number;
  setMode: (m: GameMode) => void;
  setRunning: (b: boolean) => void;
  reset: () => void;
  step: (dt: number) => void;
  setToggle: (k: keyof VectorToggles, v: boolean) => void;
  setControl: <K extends keyof ControlsState>(k: K, v: ControlsState[K]) => void;
  setCameraMode: (m: CameraMode) => void;
  setShowTrail: (b: boolean) => void;
  setShowPredicted: (b: boolean) => void;
  setShowLabels: (b: boolean) => void;
  setAimAngle: (rad: number) => void;
  setCueElevation: (rad: number) => void;
  setShotPhase: (p: ShotPhase) => void;
  commitShot: () => void;
  shoot: () => void;
}

const defaultControls = (): ControlsState => ({
  mass: 0.17,
  radius: 0.0286,
  muKinetic: 0.2,
  muRolling: 0.01,
  restitution: 0.95,
  initialSpeed: 2,
  initialOmega: 0,
  spinType: "none",
  impactForce: 60,
  impactAngle: 0,
});

const mkBall = (id: number, color: string, c: ControlsState, pos: Vec3): Ball => ({
  id,
  color,
  pos: { ...pos, y: c.radius },
  vel: v(),
  acc: v(),
  omega: v(),
  mass: c.mass,
  radius: c.radius,
  airborne: false,
  pocketed: false,
  slipDistance: 0,
  rollTime: 0,
  startedRolling: false,
});

const BALL_COLORS: Record<number, string> = {
  1: "#f4c20d",
  2: "#1d4ed8",
  3: "#dc2626",
  4: "#6d28d9",
  5: "#ea580c",
  6: "#15803d",
  7: "#7f1d1d",
  8: "#0a0a0a",
  9: "#fde047",
  10: "#60a5fa",
  11: "#f87171",
  12: "#a78bfa",
  13: "#fb923c",
  14: "#4ade80",
  15: "#b91c1c",
};

const build8BallRack = (c: ControlsState, apexZ: number): Ball[] => {
  const layout: number[][] = [
    [1],
    [9, 2],
    [10, 8, 3],
    [4, 11, 12, 5],
    [6, 13, 14, 7, 15],
  ];
  const r = c.radius;
  const dx = 2 * r;
  const dz = r * Math.sqrt(3);
  const balls: Ball[] = [mkBall(0, "#ffffff", c, v(0, 0, 0.8))];
  for (let row = 0; row < layout.length; row++) {
    const count = layout[row].length;
    const z = apexZ - row * dz;
    const xStart = -((count - 1) / 2) * dx;
    for (let i = 0; i < count; i++) {
      const num = layout[row][i];
      balls.push(mkBall(num, BALL_COLORS[num], c, v(xStart + i * dx, 0, z)));
    }
  }
  return balls;
};

const build9BallRack = (c: ControlsState, apexZ: number): Ball[] => {
  const layout: number[][] = [
    [1],
    [2, 9],
    [3, 5, 7],
    [4, 8, 6],
  ];
  const r = c.radius;
  const dx = 2 * r;
  const dz = r * Math.sqrt(3);
  const balls: Ball[] = [mkBall(0, "#ffffff", c, v(0, 0, 0.8))];
  for (let row = 0; row < layout.length; row++) {
    const count = layout[row].length;
    const z = apexZ - row * dz;
    const xStart = -((count - 1) / 2) * dx;
    for (let i = 0; i < count; i++) {
      const num = layout[row][i];
      balls.push(mkBall(num, BALL_COLORS[num], c, v(xStart + i * dx, 0, z)));
    }
  }
  return balls;
};

const buildSnookerRack = (c: ControlsState, apexZ: number): Ball[] => {
  const r = c.radius;
  const dx = 2 * r;
  const dz = r * Math.sqrt(3);
  const gap = 0.02;
  const balls: Ball[] = [];
  // Cue ball behind baulk line
  balls.push(mkBall(0, "#ffffff", c, v(0, 0, 0.8)));
  // Baulk-line colors (on the "D")
  balls.push(mkBall(2, "#f4c20d", c, v(0.2, 0, 0.6)));   // yellow — right of baulk
  balls.push(mkBall(3, "#15803d", c, v(-0.2, 0, 0.6)));  // green — left of baulk
  balls.push(mkBall(4, "#6d28d9", c, v(0, 0, 0.6)));      // brown — center baulk
  // Center spot
  balls.push(mkBall(5, "#1d4ed8", c, v(0, 0, 0)));        // blue
  // Pyramid spot — pink at apex of the triangle
  balls.push(mkBall(6, "#ea580c", c, v(0, 0, apexZ)));    // pink
  // 15 red balls in a triangle, first row touching the pink
  for (let row = 0; row < 5; row++) {
    const count = row + 1;
    const z = apexZ - 2 * r - row * dz;
    const xStart = -((count - 1) / 2) * dx;
    for (let i = 0; i < count; i++) {
      balls.push(mkBall(1, "#dc2626", c, v(xStart + i * dx, 0, z)));
    }
  }
  // Black behind the reds at a gap of one ball radius
  const lastRowZ = apexZ - 2 * r - 4 * dz;
  balls.push(mkBall(7, "#0a0a0a", c, v(0, 0, lastRowZ - 2 * r - gap)));
  return balls;
};

const buildCaromSetup = (c: ControlsState): Ball[] => [
  mkBall(0, "#ffffff", c, v(0, 0, 0.5)),
  mkBall(1, "#dc2626", c, v(-0.15, 0, -0.5)),
  mkBall(2, "#f4c20d", c, v(0.15, 0, -0.5)),
];

const setupBalls = (mode: GameMode, c: ControlsState): Ball[] => {
  switch (mode) {
    case "single":
      return [mkBall(0, "#ffffff", c, v(0, 0, 0.8))];
    case "rotation":
      return [mkBall(0, "#ffd84d", c, v(0, 0, 0))];
    case "collision":
      return build8BallRack(c, -0.5);
    case "cushion":
      return [mkBall(0, "#ffffff", c, v(-0.4, 0, 0.8))];
    case "jump":
      return [
        mkBall(0, "#ffffff", c, v(0, 0, 0.8)),
        mkBall(1, "#1e88e5", c, v(0, 0, 0.0)),
      ];
    case "8ball":
      return build8BallRack(c, -0.5);
    case "9ball":
      return build9BallRack(c, -0.5);
    case "snooker":
      return buildSnookerRack(c, -0.5);
    case "carom":
      return buildCaromSetup(c);
  }
};

const computeSystemStats = (balls: Ball[], initialTotalEnergy: number): SystemStats => {
  let totalE = 0;
  let totalP = 0;
  let totalL = 0;
  let activeCount = 0;
  for (const b of balls) {
    if (b.pocketed) continue;
    activeCount++;
    totalE += kineticEnergy(b) + rotationalEnergy(b);
    totalP += vlen(momentum(b));
    totalL += vlen(angularMomentum(b));
  }
  return {
    totalEnergy: totalE,
    totalMomentum: totalP,
    totalAngularMomentum: totalL,
    initialTotalEnergy,
    energyLost: Math.max(0, initialTotalEnergy - totalE),
    activeBalls: activeCount,
    pocketedCount: balls.length - activeCount,
  };
};

export const useSim = create<SimState>((set, get) => ({
  mode: "single",
  world: defaultWorld(),
  balls: setupBalls("single", defaultControls()),
  forces: {},
  toggles: {
    gravity: false,
    normal: false,
    friction: true,
    velocity: true,
    acceleration: false,
    momentum: false,
    omega: true,
    impulse: true,
  },
  controls: defaultControls(),
  running: false,
  time: 0,
  samples: [],
  trail: [],
  predicted: [],
  collisions: [],
  pocketEvents: [],
  cameraMode: "orbit",
  showTrail: true,
  showPredicted: true,
  showLabels: true,
  aimAngle: 0,
  cueElevation: 0.09,
  shotPhase: "idle",
  systemStats: { totalEnergy: 0, totalMomentum: 0, totalAngularMomentum: 0, initialTotalEnergy: 0, energyLost: 0, activeBalls: 0, pocketedCount: 0 },
  initialTotalEnergy: 0,

  setMode: (m) => {
    const c = get().controls;
    const b = setupBalls(m, c);
    const initE = b.reduce((sum, ball) => sum + kineticEnergy(ball) + rotationalEnergy(ball), 0);
    set({
      mode: m,
      balls: b,
      time: 0,
      samples: [],
      trail: [],
      predicted: [],
      collisions: [],
      pocketEvents: [],
      forces: {},
      running: false,
      shotPhase: "idle",
      systemStats: computeSystemStats(b, initE),
      initialTotalEnergy: initE,
    });
  },
  setRunning: (b) => set({ running: b }),
  reset: () => {
    const { mode, controls } = get();
    const balls = setupBalls(mode, controls);
    const initE = balls.reduce((sum, ball) => sum + kineticEnergy(ball) + rotationalEnergy(ball), 0);
    set({
      balls,
      time: 0,
      samples: [],
      trail: [],
      predicted: [],
      collisions: [],
      pocketEvents: [],
      forces: {},
      running: false,
      shotPhase: "idle",
      systemStats: computeSystemStats(balls, initE),
      initialTotalEnergy: initE,
    });
  },
  setToggle: (k, val) => set((s) => ({ toggles: { ...s.toggles, [k]: val } })),
  setControl: (k, val) =>
    set((s) => {
      const controls = { ...s.controls, [k]: val };
      const world = {
        ...s.world,
        muKinetic: controls.muKinetic,
        muRolling: controls.muRolling,
        restitution: controls.restitution,
        cushionRestitution: controls.restitution * 0.9,
      };
      const patch: Partial<SimState> = { controls, world };
      if (k === "impactAngle") {
        patch.aimAngle = ((val as number) * Math.PI) / 180;
      }
      return patch as SimState;
    }),
  setCameraMode: (m) => set({ cameraMode: m }),
  setShowTrail: (b) => set({ showTrail: b }),
  setShowPredicted: (b) => set({ showPredicted: b }),
  setShowLabels: (b) => set({ showLabels: b }),
  setAimAngle: (rad) => set({ aimAngle: rad }),
  setCueElevation: (rad) =>
    set({ cueElevation: Math.max(0, Math.min(Math.PI / 2.2, rad)) }),
  setShotPhase: (p) => set({ shotPhase: p }),

  shoot: () => {
    const { shotPhase, running } = get();
    if (running || shotPhase !== "idle") return;
    set({ shotPhase: "pullback" });
  },

  commitShot: () => {
    const { balls, controls, mode, aimAngle, cueElevation } = get();
    if (!balls.length) return;
    const cue = balls[0];
    let offRight = 0;
    let offUp = 0;
    const r = cue.radius * 0.5;
    switch (controls.spinType) {
      case "top":
        offUp = r;
        break;
      case "back":
        offUp = -r;
        break;
      case "side":
        offRight = r;
        break;
      case "masse":
        offUp = -r;
        offRight = r * 0.6;
        break;
      case "swerve":
        offRight = r * 0.3;
        break;
    }
    if (mode === "jump") {
      offUp = -r;
    }
    const angleDeg = (aimAngle * 180) / Math.PI;
    applyCue(cue, controls.impactForce, angleDeg, offRight, offUp, cueElevation);

    const initE = get().balls.reduce((sum, ball) => sum + kineticEnergy(ball) + rotationalEnergy(ball), 0);
    set({ running: true, shotPhase: "fired", initialTotalEnergy: initE });
  },

  step: (dt) => {
    const { balls, world, time, samples, trail, collisions, pocketEvents, initialTotalEnergy } = get();
    const forces: Record<number, BallForces> = {};

    const preStepVel = balls.map((b) => ({ ...b.vel }));
    for (const b of balls) {
      if (b.pocketed) continue;
      forces[b.id] = stepBall(b, world, dt);
    }

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.pocketed) continue;
      const pre = preStepVel[i];
      const vxFlip = Math.sign(pre.x) !== 0 && Math.sign(b.vel.x) !== Math.sign(pre.x);
      const vzFlip = Math.sign(pre.z) !== 0 && Math.sign(b.vel.z) !== Math.sign(pre.z);
      if ((vxFlip || vzFlip) && vlen(pre) > 0.05) {
        playCushionSound(vlen(pre));
      }
    }

    const preVel = balls.map((b) => ({ ...b.vel }));
    const newColl: CollisionEvent[] = [];

    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        if (a.pocketed || b.pocketed) continue;
        const preA = preVel[i];
        const preB = preVel[j];
        if (resolveCollision(a, b, world.restitution)) {
          const dvx = a.vel.x - preA.x;
          const dvy = a.vel.y - preA.y;
          const dvz = a.vel.z - preA.z;
          const mag = a.mass * Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
          const cx = (a.pos.x + b.pos.x) / 2;
          const cy = (a.pos.y + b.pos.y) / 2;
          const cz = (a.pos.z + b.pos.z) / 2;
          const nx = b.pos.x - a.pos.x;
          const nz = b.pos.z - a.pos.z;
          const nl = Math.hypot(nx, nz) || 1;
          newColl.push({
            id: Date.now() + Math.random(),
            pos: { x: cx, y: cy, z: cz },
            magnitude: mag,
            normal: { x: nx / nl, y: 0, z: nz / nl },
            bornAt: time + dt,
            angleDeg: (collisionAngle(a, b, preA, preB) * 180) / Math.PI,
          });
          playCollisionSound(mag);
        }
      }
    }

    const newPocketEvents: PocketEvent[] = [];
    for (const b of balls) {
      if (b.pocketed) continue;
      const pocket = detectPocketing(b, world.pockets);
      if (pocket) {
        b.pocketed = true;
        newPocketEvents.push({
          id: Date.now() + Math.random(),
          ballId: b.id,
          pocketId: pocket.id,
          time: time + dt,
        });
      }
    }

    const activeBalls = balls.filter((b) => !b.pocketed);
    const target = activeBalls[0] || balls[0];
    const speed = vlen(target.vel);
    const accel = vlen(target.acc);
    const p = vlen(momentum(target));
    const om = vlen(target.omega);
    const E = kineticEnergy(target) + rotationalEnergy(target);
    const newTime = time + dt;

    const stats = computeSystemStats(balls, initialTotalEnergy);

    const sample: SamplePoint = {
      t: +newTime.toFixed(3),
      speed: +speed.toFixed(4),
      accel: +accel.toFixed(4),
      momentum: +p.toFixed(4),
      omega: +om.toFixed(4),
      energy: +E.toFixed(4),
      totalEnergy: +stats.totalEnergy.toFixed(4),
      energyLost: +stats.energyLost.toFixed(4),
      totalMomentum: +stats.totalMomentum.toFixed(4),
      totalAngularMomentum: +stats.totalAngularMomentum.toFixed(4),
    };
    const newSamples = samples.length > 600 ? [...samples.slice(-599), sample] : [...samples, sample];
    const newTrail =
      trail.length > 400
        ? [...trail.slice(-399), { ...target.pos }]
        : [...trail, { ...target.pos }];

    const predicted: Vec3[] = [];
    if (!target.airborne && speed > 0.05) {
      const decel = world.muRolling * world.gravity + 0.001;
      let px = target.pos.x;
      let pz = target.pos.z;
      let vx = target.vel.x;
      let vz = target.vel.z;
      const sp = Math.hypot(vx, vz);
      const stopT = sp / Math.max(decel, 1e-4);
      const steps = 60;
      const stepT = Math.min(stopT, 3) / steps;
      for (let k = 0; k < steps; k++) {
        const s = Math.hypot(vx, vz);
        if (s < 0.02) break;
        const ax = -(vx / s) * decel;
        const az = -(vz / s) * decel;
        vx += ax * stepT;
        vz += az * stepT;
        px += vx * stepT;
        pz += vz * stepT;
        if (px - target.radius < -world.tableHalfWidth) {
          px = -world.tableHalfWidth + target.radius;
          vx = -vx * world.cushionRestitution;
        } else if (px + target.radius > world.tableHalfWidth) {
          px = world.tableHalfWidth - target.radius;
          vx = -vx * world.cushionRestitution;
        }
        if (pz - target.radius < -world.tableHalfLength) {
          pz = -world.tableHalfLength + target.radius;
          vz = -vz * world.cushionRestitution;
        } else if (pz + target.radius > world.tableHalfLength) {
          pz = world.tableHalfLength - target.radius;
          vz = -vz * world.cushionRestitution;
        }
        predicted.push({ x: px, y: target.radius, z: pz });
      }
    }

    const keptColl = [...collisions, ...newColl].filter((c) => newTime - c.bornAt < 1.2);
    const allPocketEvents = [...pocketEvents, ...newPocketEvents];

    let maxSpeed = 0;
    for (const b of balls) {
      if (b.pocketed) continue;
      const s = vlen(b.vel);
      if (s > maxSpeed) maxSpeed = s;
    }
    const stateRunning = get().running;
    const stateShotPhase = get().shotPhase;
    const patch: Partial<SimState> = {
      balls: [...balls],
      forces,
      time: newTime,
      samples: newSamples,
      trail: newTrail,
      predicted,
      collisions: keptColl,
      pocketEvents: allPocketEvents,
      systemStats: stats,
    };
    if (stateRunning && maxSpeed < 0.015 && stateShotPhase !== "pullback" && stateShotPhase !== "impact") {
      patch.running = false;
      patch.shotPhase = "idle";
    }
    set(patch as SimState);
  },
}));

export const computeStats = (b: Ball) => ({
  ke: kineticEnergy(b),
  re: rotationalEnergy(b),
  p: momentum(b),
  L: angularMomentum(b),
});
