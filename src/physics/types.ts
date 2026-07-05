export type Vec3 = { x: number; y: number; z: number };

export const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const vadd = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vsub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vscale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const vdot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const vcross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const vlen = (a: Vec3): number => Math.sqrt(vdot(a, a));
export const vnorm = (a: Vec3): Vec3 => {
  const l = vlen(a);
  return l < 1e-9 ? v() : vscale(a, 1 / l);
};

export interface Ball {
  id: number;
  color: string;
  pos: Vec3;
  vel: Vec3;
  acc: Vec3;
  omega: Vec3;
  mass: number;
  radius: number;
  airborne: boolean;
  pocketed: boolean;
  slipDistance: number;
  rollTime: number;
  startedRolling: boolean;
}

export const momentOfInertia = (b: Ball): number => (2 / 5) * b.mass * b.radius * b.radius;

export const kineticEnergy = (b: Ball): number => 0.5 * b.mass * vdot(b.vel, b.vel);
export const rotationalEnergy = (b: Ball): number =>
  0.5 * momentOfInertia(b) * vdot(b.omega, b.omega);
export const momentum = (b: Ball): Vec3 => vscale(b.vel, b.mass);
export const angularMomentum = (b: Ball): Vec3 => vscale(b.omega, momentOfInertia(b));

export const angleBetween = (a: Vec3, b: Vec3): number => {
  const da = vlen(a);
  const db = vlen(b);
  if (da < 1e-9 || db < 1e-9) return 0;
  const c = vdot(a, b) / (da * db);
  return Math.acos(Math.max(-1, Math.min(1, c)));
};

export type PocketId = "tl" | "tr" | "bl" | "br" | "tm" | "bm";

export interface PocketDef {
  id: PocketId;
  pos: Vec3;
  radius: number;
}
