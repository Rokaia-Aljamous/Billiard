import {
  Ball,
  Vec3,
  momentOfInertia,
  v,
  vadd,
  vcross,
  vdot,
  vlen,
  vnorm,
  vscale,
  vsub,
} from "./types";

export interface World {
  gravity: number; // m/s^2 (positive)
  muKinetic: number; // sliding friction
  muRolling: number; // rolling resistance
  restitution: number; // ball-ball
  cushionRestitution: number;
  tableHalfWidth: number; // x extent (half), meters
  tableHalfLength: number; // z extent (half)
  cushionsEnabled: boolean;
}

export const defaultWorld = (): World => ({
  gravity: 9.81,
  muKinetic: 0.2,
  muRolling: 0.01,
  restitution: 0.95,
  cushionRestitution: 0.85,
  tableHalfWidth: 0.6,
  tableHalfLength: 1.2,
  cushionsEnabled: true,
});

/**
 * Compute net force/torque on a ball and integrate one step.
 * Returns the forces applied for diagnostic display.
 */
export interface BallForces {
  gravity: Vec3;
  normal: Vec3;
  friction: Vec3;
  torque: Vec3;
}

export const stepBall = (b: Ball, w: World, dt: number): BallForces => {
  const g = w.gravity;
  const I = momentOfInertia(b);
  const gravity: Vec3 = v(0, -b.mass * g, 0);
  let normal: Vec3 = v();
  let friction: Vec3 = v();
  let torque: Vec3 = v();

  if (b.airborne || b.pos.y > b.radius + 1e-4) {
    b.airborne = true;
    b.acc = vscale(gravity, 1 / b.mass);
  } else {
    // On table: normal cancels gravity
    normal = v(0, b.mass * g, 0);
    // Contact point velocity: v + ω × r_contact, r_contact = (0,-R,0)
    const rC: Vec3 = v(0, -b.radius, 0);
    const vC = vadd(b.vel, vcross(b.omega, rC));
    const vCh: Vec3 = v(vC.x, 0, vC.z); // horizontal slip
    const slip = vlen(vCh);
    if (slip > 0.02) {
      // Kinetic sliding friction opposes slip
      const dir = vnorm(vCh);
      const Ff = vscale(dir, -w.muKinetic * b.mass * g);
      friction = Ff;
      // Torque about center = r_contact × F
      torque = vcross(rC, Ff);
    } else {
      // Rolling: small rolling resistance
      const speed = vlen(b.vel);
      if (speed > 1e-3) {
        const dir = vnorm(b.vel);
        const Frr = vscale(dir, -w.muRolling * b.mass * g);
        friction = Frr;
      }
      // Match angular velocity to rolling without slipping: ω = (n × v)/R, n = up
      const up: Vec3 = v(0, 1, 0);
      const target = vscale(vcross(up, b.vel), 1 / b.radius);
      // Blend toward rolling (preserves vertical spin component)
      b.omega.x = target.x;
      b.omega.z = target.z;
    }
    b.acc = vscale(vadd(friction, v()), 1 / b.mass); // net horizontal acceleration
    // Keep ball on table
    b.pos.y = b.radius;
    if (b.vel.y < 0) b.vel.y = 0;
  }

  // Integrate translation
  b.vel = vadd(b.vel, vscale(b.acc, dt));
  b.pos = vadd(b.pos, vscale(b.vel, dt));

  // Integrate rotation from torque (only when sliding)
  if (vlen(torque) > 1e-9) {
    const alpha = vscale(torque, 1 / I);
    b.omega = vadd(b.omega, vscale(alpha, dt));
  }

  // Landing
  if (b.airborne && b.pos.y <= b.radius) {
    b.pos.y = b.radius;
    b.vel.y = -b.vel.y * w.cushionRestitution;
    if (Math.abs(b.vel.y) < 0.3) {
      b.vel.y = 0;
      b.airborne = false;
    }
  }

  // Cushions
  if (w.cushionsEnabled && !b.airborne) {
    if (b.pos.x - b.radius < -w.tableHalfWidth) {
      b.pos.x = -w.tableHalfWidth + b.radius;
      b.vel.x = -b.vel.x * w.cushionRestitution;
    } else if (b.pos.x + b.radius > w.tableHalfWidth) {
      b.pos.x = w.tableHalfWidth - b.radius;
      b.vel.x = -b.vel.x * w.cushionRestitution;
    }
    if (b.pos.z - b.radius < -w.tableHalfLength) {
      b.pos.z = -w.tableHalfLength + b.radius;
      b.vel.z = -b.vel.z * w.cushionRestitution;
    } else if (b.pos.z + b.radius > w.tableHalfLength) {
      b.pos.z = w.tableHalfLength - b.radius;
      b.vel.z = -b.vel.z * w.cushionRestitution;
    }
  }

  return { gravity, normal, friction, torque };
};

/** Resolve elastic (with restitution) collision between two equal-radius balls. */
export const resolveCollision = (a: Ball, b: Ball, e: number): boolean => {
  const delta = vsub(b.pos, a.pos);
  const dist = vlen(delta);
  const minDist = a.radius + b.radius;
  if (dist >= minDist || dist < 1e-9) return false;
  const n = vscale(delta, 1 / dist);
  // Push out
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
  return true;
};

/** Apply cue impact: linear impulse + spin from off-center hit.
 *  offset: contact offset from center in ball-local axes (right/up).
 */
export const applyCue = (
  ball: Ball,
  forceN: number,
  angleDeg: number,
  offsetRight: number,
  offsetUp: number,
  durationS = 0.005,
) => {
  const rad = (angleDeg * Math.PI) / 180;
  const dir: Vec3 = v(Math.sin(rad), 0, -Math.cos(rad));
  const impulse = vscale(dir, forceN * durationS);
  ball.vel = vadd(ball.vel, vscale(impulse, 1 / ball.mass));
  // Off-center → torque. r = offsets in local frame relative to ball center
  // Use right = perpendicular to dir on table plane, up = world Y
  const right: Vec3 = v(Math.cos(rad), 0, Math.sin(rad));
  const up: Vec3 = v(0, 1, 0);
  const r = vadd(vscale(right, offsetRight), vscale(up, offsetUp));
  const angImpulse = vcross(r, impulse); // L = r × p
  const I = momentOfInertia(ball);
  ball.omega = vadd(ball.omega, vscale(angImpulse, 1 / I));
  // Jump if hit below center with downward cue is approximated by upward velocity from up offset
  if (offsetUp < -0.005) {
    ball.vel.y += (forceN * durationS * -offsetUp * 40) / ball.mass;
    ball.airborne = true;
  }
};
