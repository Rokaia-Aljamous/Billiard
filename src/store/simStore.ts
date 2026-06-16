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

  setMode: (m) => {
    const c = get().controls;
    set({
      mode: m,
      balls: setupBalls(m, c),
      time: 0,
      samples: [],
      trail: [],
      forces: {},
      running: false,
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
      forces: {},
      running: false,
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
      return { controls, world };
    }),

  shoot: () => {
    const { balls, controls, mode } = get();
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
    applyCue(cue, controls.impactForce, controls.impactAngle, offRight, offUp);
    set({ running: true });
  },

  step: (dt) => {
    const { balls, world, time, samples, trail } = get();
    const forces: Record<number, BallForces> = {};
    for (const b of balls) {
      forces[b.id] = stepBall(b, world, dt);
    }
    // collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        resolveCollision(balls[i], balls[j], world.restitution);
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
    set({
      balls: [...balls],
      forces,
      time: newTime,
      samples: newSamples,
      trail: newTrail,
    });
  },
}));

export const computeStats = (b: Ball) => ({
  ke: kineticEnergy(b),
  re: rotationalEnergy(b),
  p: momentum(b),
  L: angularMomentum(b),
});
