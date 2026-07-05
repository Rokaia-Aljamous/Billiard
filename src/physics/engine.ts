import {
  Ball,
  Vec3,
  PocketDef,
  momentOfInertia,
  v,
  vadd,
  vcross,
  vdot,
  vlen,
  vnorm,
  vscale,
  vsub,
  angleBetween,
} from "./types";

export interface World {
  gravity: number;
  muKinetic: number;
  muRolling: number;
  restitution: number;
  cushionRestitution: number;
  tableHalfWidth: number;
  tableHalfLength: number;
  cushionsEnabled: boolean;
  pockets: PocketDef[];
}

const defaultPockets = (hw: number, hl: number): PocketDef[] => [
  { id: "tl", pos: v(-hw, 0, -hl), radius: 0.055 },
  { id: "tr", pos: v(hw, 0, -hl), radius: 0.055 },
  { id: "bl", pos: v(-hw, 0, hl), radius: 0.055 },
  { id: "br", pos: v(hw, 0, hl), radius: 0.055 },
  { id: "tm", pos: v(-hw, 0, 0), radius: 0.048 },
  { id: "bm", pos: v(hw, 0, 0), radius: 0.048 },
];

export const defaultWorld = (): World => ({
  gravity: 9.81,
  muKinetic: 0.2,
  muRolling: 0.01,
  restitution: 0.95,
  cushionRestitution: 0.85,
  tableHalfWidth: 0.6,
  tableHalfLength: 1.2,
  cushionsEnabled: true,
  pockets: defaultPockets(0.6, 1.2),
});

export interface BallForces {
  gravity: Vec3;
  normal: Vec3;
  friction: Vec3;
  torque: Vec3;
}

export const detectPocketing = (b: Ball, pockets: PocketDef[]): PocketDef | null => {
  if (b.pocketed) return null;
  for (const p of pockets) {
    const d2 = (b.pos.x - p.pos.x) ** 2 + (b.pos.z - p.pos.z) ** 2;
    if (d2 < p.radius * p.radius) return p;
  }
  return null;
};

export const collisionAngle = (a: Ball, b: Ball, preVelA: Vec3, preVelB: Vec3): number => {
  const relPre = vsub(preVelB, preVelA);
  const relPost = vsub(b.vel, a.vel);
  return angleBetween(relPre, relPost);
};

export const stepBall = (b: Ball, w: World, dt: number): BallForces => {
  const g = w.gravity;
  const I = momentOfInertia(b);
  const gravity: Vec3 = v(0, -b.mass * g, 0);
  let normal: Vec3 = v();
  let friction: Vec3 = v();
  let torque: Vec3 = v();

  if (b.pocketed) {
    b.acc = v();
    return { gravity, normal, friction, torque };
  }

  if (b.airborne || b.pos.y > b.radius + 1e-4) {
    b.airborne = true;
    b.acc = vscale(gravity, 1 / b.mass);
  } else {
    normal = v(0, b.mass * g, 0);
    const rC: Vec3 = v(0, -b.radius, 0);
    const vC = vadd(b.vel, vcross(b.omega, rC));
    const vCh: Vec3 = v(vC.x, 0, vC.z);
    const slip = vlen(vCh);

    b.slipDistance += vlen(b.vel) * dt;

    if (slip > 0.02) {
      const dir = vnorm(vCh);
      const Ff = vscale(dir, -w.muKinetic * b.mass * g);
      friction = Ff;
      torque = vcross(rC, Ff);
      b.startedRolling = false;
    } else {
      if (!b.startedRolling) {
        b.startedRolling = true;
        b.rollTime = 0;
      }
      b.rollTime += dt;

      const speed = vlen(b.vel);
      if (speed > 1e-3) {
        const dir = vnorm(b.vel);
        const Frr = vscale(dir, -w.muRolling * b.mass * g);
        friction = Frr;
      }
      const up: Vec3 = v(0, 1, 0);
      const target = vscale(vcross(up, b.vel), 1 / b.radius);
      b.omega.x = target.x;
      b.omega.z = target.z;
    }

    b.acc = vscale(vadd(friction, v()), 1 / b.mass);
    b.pos.y = b.radius;
    if (b.vel.y < 0) b.vel.y = 0;
  }

  b.vel = vadd(b.vel, vscale(b.acc, dt));
  b.pos = vadd(b.pos, vscale(b.vel, dt));

  if (vlen(torque) > 1e-9) {
    const alpha = vscale(torque, 1 / I);
    b.omega = vadd(b.omega, vscale(alpha, dt));
  }

  if (b.airborne && b.pos.y <= b.radius) {
    b.pos.y = b.radius;
    b.vel.y = -b.vel.y * w.cushionRestitution;
    if (Math.abs(b.vel.y) < 0.3) {
      b.vel.y = 0;
      b.airborne = false;
    }
  }

  if (w.cushionsEnabled && !b.airborne) {
    let hitCushion = false;
    if (b.pos.x - b.radius < -w.tableHalfWidth) {
      b.pos.x = -w.tableHalfWidth + b.radius;
      b.vel.x = -b.vel.x * w.cushionRestitution;
      b.omega.z = -b.omega.z * w.cushionRestitution;
      b.omega.x = b.omega.x * w.cushionRestitution;
      hitCushion = true;
    } else if (b.pos.x + b.radius > w.tableHalfWidth) {
      b.pos.x = w.tableHalfWidth - b.radius;
      b.vel.x = -b.vel.x * w.cushionRestitution;
      b.omega.z = -b.omega.z * w.cushionRestitution;
      b.omega.x = b.omega.x * w.cushionRestitution;
      hitCushion = true;
    }
    if (b.pos.z - b.radius < -w.tableHalfLength) {
      b.pos.z = -w.tableHalfLength + b.radius;
      b.vel.z = -b.vel.z * w.cushionRestitution;
      b.omega.x = -b.omega.x * w.cushionRestitution;
      b.omega.z = b.omega.z * w.cushionRestitution;
      hitCushion = true;
    } else if (b.pos.z + b.radius > w.tableHalfLength) {
      b.pos.z = w.tableHalfLength - b.radius;
      b.vel.z = -b.vel.z * w.cushionRestitution;
      b.omega.x = -b.omega.x * w.cushionRestitution;
      b.omega.z = b.omega.z * w.cushionRestitution;
      hitCushion = true;
    }
    if (hitCushion) {
      b.startedRolling = false;
    }
  }

  return { gravity, normal, friction, torque };
};

export const resolveCollision = (a: Ball, b: Ball, e: number, muFriction = 0.05): boolean => {
  const delta = vsub(b.pos, a.pos);
  const dist = vlen(delta);
  const minDist = a.radius + b.radius;
  if (dist >= minDist || dist < 1e-9) return false;
  const n = vscale(delta, 1 / dist);
  const tangent: Vec3 = vnorm(v(n.z, 0, -n.x));

  const overlap = minDist - dist;
  a.pos = vsub(a.pos, vscale(n, overlap / 2));
  b.pos = vadd(b.pos, vscale(n, overlap / 2));

  const relVel = vsub(b.vel, a.vel);
  const vn = vdot(relVel, n);
  if (vn > 0) return false;

  const j = (-(1 + e) * vn) / (1 / a.mass + 1 / b.mass);
  const impulse = vscale(n, j);
  a.vel = vsub(a.vel, vscale(impulse, 1 / a.mass));
  b.vel = vadd(b.vel, vscale(impulse, 1 / b.mass));

  const vt = vdot(relVel, tangent);
  const frictionImpulseMag = muFriction * Math.abs(j);
  const ft = vscale(tangent, -Math.min(frictionImpulseMag, Math.abs(vt) / (1 / a.mass + 1 / b.mass)) * Math.sign(vt));
  if (Math.abs(vt) > 1e-9) {
    a.vel = vsub(a.vel, vscale(ft, 1 / a.mass));
    b.vel = vadd(b.vel, vscale(ft, 1 / b.mass));

    const rA: Vec3 = v(0, -a.radius, 0);
    const rB: Vec3 = v(0, -b.radius, 0);
    const tauA = vcross(rA, vscale(ft, -1));
    const tauB = vcross(rB, ft);
    const Ia = momentOfInertia(a);
    const Ib = momentOfInertia(b);
    a.omega = vadd(a.omega, vscale(tauA, 1 / Ia));
    b.omega = vadd(b.omega, vscale(tauB, 1 / Ib));
  }

  a.startedRolling = false;
  b.startedRolling = false;

  return true;
};

export const applyCue = (
  ball: Ball,
  forceN: number,
  angleDeg: number,
  offsetRight: number,
  offsetUp: number,
  cueElevationRad = 0,
  durationS = 0.005,
) => {
  const rad = (angleDeg * Math.PI) / 180;
  const dir: Vec3 = v(Math.sin(rad), Math.sin(cueElevationRad), -Math.cos(rad));
  const dirH = vlen(v(dir.x, 0, dir.z));
  const impulse = vscale(v(dir.x / (dirH || 1), dir.y, dir.z / (dirH || 1)), forceN * durationS);
  ball.vel = vadd(ball.vel, vscale(impulse, 1 / ball.mass));

  const right: Vec3 = v(Math.cos(rad), 0, Math.sin(rad));
  const up: Vec3 = v(0, 1, 0);
  const r = vadd(vscale(right, offsetRight), vscale(up, offsetUp));
  const angImpulse = vcross(r, impulse);
  const I = momentOfInertia(ball);
  ball.omega = vadd(ball.omega, vscale(angImpulse, 1 / I));

  if (offsetUp < -0.005) {
    ball.vel.y += (forceN * durationS * -offsetUp * 40) / ball.mass;
    ball.airborne = true;
  }
};
