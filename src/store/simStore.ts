import { create } from "zustand";
import {
  Ball,
  Vec3,
  angularMomentum,
  kineticEnergy,
  momentum,
  rotationalEnergy,
  v,
  vlen,
} from "@/physics/types";
import {
  BallForces,
  World,
  applyCue,
  defaultWorld,
  resolveCollision,
  stepBall,
} from "@/physics/engine";

export type Mode = "single" | "rotation" | "collision" | "cushion" | "jump";

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
}

export interface SamplePoint {
  t: number;
  speed: number;
  accel: number;
  momentum: number;
  omega: number;
  energy: number;
}

interface ControlsState {
  mass: number;
  radius: number;
  muKinetic: number;
  muRolling: number;
  restitution: number;
  initialSpeed: number;
  initialOmega: number; // side/top spin magnitude
  spinType: "top" | "back" | "side" | "masse" | "none";
  impactForce: number;
  impactAngle: number;
}

interface SimState {
  mode: Mode;
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
  cameraMode: CameraMode;
  showTrail: boolean;
  showPredicted: boolean;
  showLabels: boolean;
  aimAngle: number; // radians; 0 = -Z, matches applyCue convention
  shotPhase: ShotPhase;
  // actions
  setMode: (m: Mode) => void;
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
});

const setupBalls = (mode: Mode, c: ControlsState): Ball[] => {
  switch (mode) {
    case "single":
      return [mkBall(0, "#ffffff", c, v(0, 0, 0.8))];
    case "rotation":
      return [mkBall(0, "#ffd84d", c, v(0, 0, 0))];
    case "collision":
      return [
        mkBall(0, "#ffffff", c, v(0, 0, 0.8)),
        mkBall(1, "#e53935", c, v(0, 0, -0.4)),
      ];
    case "cushion":
      return [mkBall(0, "#ffffff", c, v(-0.4, 0, 0.8))];
    case "jump":
      return [
        mkBall(0, "#ffffff", c, v(0, 0, 0.8)),
        mkBall(1, "#1e88e5", c, v(0, 0, 0.0)),
      ];
  }
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
  cameraMode: "orbit",
  showTrail: true,
  showPredicted: true,
  showLabels: true,
  aimAngle: 0,
  shotPhase: "idle",

  setMode: (m) => {
    const c = get().controls;
    set({
      mode: m,
      balls: setupBalls(m, c),
      time: 0,
      samples: [],
      trail: [],
      predicted: [],
      collisions: [],
      forces: {},
      running: false,
      shotPhase: "idle",
    });
  },
  setRunning: (b) => set({ running: b }),
  reset: () => {
    const { mode, controls } = get();
    set({
      balls: setupBalls(mode, controls),
      time: 0,
      samples: [],
      trail: [],
      predicted: [],
      collisions: [],
      forces: {},
      running: false,
      shotPhase: "idle",
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
  setShotPhase: (p) => set({ shotPhase: p }),

  shoot: () => {
    const { shotPhase, running } = get();
    if (running || shotPhase !== "idle") return;
    set({ shotPhase: "pullback" });
  },

  commitShot: () => {
    const { balls, controls, mode, aimAngle } = get();
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
    }
    if (mode === "jump") {
      offUp = -r;
    }
    const angleDeg = (aimAngle * 180) / Math.PI;
    applyCue(cue, controls.impactForce, angleDeg, offRight, offUp);
    set({ running: true, shotPhase: "fired" });
  },


  step: (dt) => {
    const { balls, world, time, samples, trail, collisions } = get();
    const forces: Record<number, BallForces> = {};
    for (const b of balls) {
      forces[b.id] = stepBall(b, world, dt);
    }
    // collisions — snapshot pre-vel to derive impulse magnitude after physics resolves
    const preVel = balls.map((b) => ({ ...b.vel }));
    const newColl: CollisionEvent[] = [];
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        if (resolveCollision(a, b, world.restitution)) {
          const dvx = a.vel.x - preVel[i].x;
          const dvy = a.vel.y - preVel[i].y;
          const dvz = a.vel.z - preVel[i].z;
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
          });
        }
      }
    }
    const target = balls[0];
    const speed = vlen(target.vel);
    const accel = vlen(target.acc);
    const p = vlen(momentum(target));
    const om = vlen(target.omega);
    const E = kineticEnergy(target) + rotationalEnergy(target);
    const newTime = time + dt;
    const sample: SamplePoint = {
      t: +newTime.toFixed(3),
      speed: +speed.toFixed(4),
      accel: +accel.toFixed(4),
      momentum: +p.toFixed(4),
      omega: +om.toFixed(4),
      energy: +E.toFixed(4),
    };
    const newSamples = samples.length > 600 ? [...samples.slice(-599), sample] : [...samples, sample];
    const newTrail =
      trail.length > 400
        ? [...trail.slice(-399), { ...target.pos }]
        : [...trail, { ...target.pos }];

    // Predicted trajectory: simple forward extrapolation under rolling deceleration + cushion reflection.
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
        // cushion reflect
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

    // age collision flashes (keep 1.2s)
    const keptColl = [...collisions, ...newColl].filter((c) => newTime - c.bornAt < 1.2);

    // Auto-stop when all balls are essentially at rest
    let maxSpeed = 0;
    for (const b of balls) {
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
