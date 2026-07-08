import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Line,
  Html,
  Grid,
} from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useSim, CameraMode, CollisionEvent, CushionBounceEvent } from "@/store/simStore";
import { Ball, Vec3, vlen, vnorm, vscale, vdot } from "@/physics/types";

/* -------------------------------------------------------------------------- */
/*  Force / vector arrow with magnitude label                                  */
/* -------------------------------------------------------------------------- */
const VectorArrow = ({
  origin,
  vec,
  color,
  scale = 0.3,
  label,
  unit,
  showLabel,
}: {
  origin: Vec3;
  vec: Vec3;
  color: string;
  scale?: number;
  label?: string;
  unit?: string;
  showLabel?: boolean;
}) => {
  const mag = vlen(vec);
  const len = mag * scale;
  const dir = vnorm(vec);
  const tip = useMemo(
    () => ({
      x: origin.x + dir.x * len,
      y: origin.y + dir.y * len,
      z: origin.z + dir.z * len,
    }),
    [origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, len],
  );
  const points = useMemo(
    () => [
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(tip.x, tip.y, tip.z),
    ],
    [origin.x, origin.y, origin.z, tip.x, tip.y, tip.z],
  );
  if (len < 0.015) return null;
  const headDir = new THREE.Vector3(dir.x, dir.y, dir.z);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), headDir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <group>
      <Line points={points} color={color} lineWidth={2.2} />
      <mesh position={[tip.x, tip.y, tip.z]} rotation={[euler.x, euler.y, euler.z]}>
        <coneGeometry args={[0.014, 0.045, 14]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {showLabel && label && (
        <Html
          position={[tip.x, tip.y + 0.025, tip.z]}
          center
          distanceFactor={1.4}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] leading-none"
            style={{
              background: "rgba(8,12,20,0.78)",
              color,
              border: `1px solid ${color}55`,
              whiteSpace: "nowrap",
            }}
          >
            {label} {mag.toFixed(2)}
            {unit && <span className="opacity-70"> {unit}</span>}
          </div>
        </Html>
      )}
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/*  Professional pool table — cloth, rails, frame, 6 pockets, diamonds         */
/* -------------------------------------------------------------------------- */
const Pocket = ({ x, z, r = 0.05 }: { x: number; z: number; r?: number }) => (
  <group position={[x, 0.001, z]}>
    {/* dark recess */}
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[r, 32]} />
      <meshStandardMaterial color="#02060a" roughness={1} metalness={0} />
    </mesh>
    {/* leather ring */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0008, 0]}>
      <ringGeometry args={[r, r + 0.012, 32]} />
      <meshStandardMaterial color="#1a120a" roughness={0.85} />
    </mesh>
  </group>
);

const Diamond = ({ x, z }: { x: number; z: number }) => (
  <mesh position={[x, 0.036, z]} rotation={[0, Math.PI / 4, 0]}>
    <boxGeometry args={[0.012, 0.004, 0.012]} />
    <meshStandardMaterial color="#f4e9c6" metalness={0.6} roughness={0.3} />
  </mesh>
);

const Table = () => {
  const w = useSim((s) => s.world);
  const hw = w.tableHalfWidth;
  const hl = w.tableHalfLength;
  const railH = 0.05;
  const railT = 0.06;
  const frameOverhang = 0.11;

  // Diamond marker positions (3 per long side, 1.5 per short — classic 6/2 layout simplified)
  const diamondsLong = [-0.5, 0, 0.5].map((f) => f * hl);
  const diamondsShort = [-0.4, 0.4].map((f) => f * hw);

  return (
    <group>
      {/* Wooden outer frame */}
      <mesh
        position={[0, -0.04, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[(hw + frameOverhang) * 2, 0.08, (hl + frameOverhang) * 2]}
        />
        <meshStandardMaterial color="#3d1f0f" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Slate base under cloth */}
      <mesh position={[0, -0.005, 0]} receiveShadow>
        <boxGeometry args={[hw * 2 + 0.02, 0.01, hl * 2 + 0.02]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {/* Cloth */}
      <mesh receiveShadow position={[0, 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[hw * 2, hl * 2]} />
        <meshStandardMaterial
          color="#0e7a4a"
          roughness={0.95}
          metalness={0}
          emissive="#02140a"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Cushions (slightly inset so they meet the cloth edges) */}
      {[
        [hw + railT / 2, railH / 2, 0, railT, railH, hl * 2],
        [-(hw + railT / 2), railH / 2, 0, railT, railH, hl * 2],
        [0, railH / 2, hl + railT / 2, hw * 2, railH, railT],
        [0, railH / 2, -(hl + railT / 2), hw * 2, railH, railT],
      ].map((a, i) => (
        <mesh key={i} position={[a[0], a[1], a[2]]} castShadow receiveShadow>
          <boxGeometry args={[a[3], a[4], a[5]]} />
          <meshStandardMaterial color="#0a4d2f" roughness={0.85} />
        </mesh>
      ))}

      {/* Rail top (wood) */}
      {[
        [hw + railT / 2 + 0.025, railH + 0.005, 0, 0.05, 0.01, hl * 2 + 0.2],
        [-(hw + railT / 2 + 0.025), railH + 0.005, 0, 0.05, 0.01, hl * 2 + 0.2],
        [0, railH + 0.005, hl + railT / 2 + 0.025, hw * 2 + 0.2, 0.01, 0.05],
        [0, railH + 0.005, -(hl + railT / 2 + 0.025), hw * 2 + 0.2, 0.01, 0.05],
      ].map((a, i) => (
        <mesh key={`r${i}`} position={[a[0], a[1], a[2]]} castShadow>
          <boxGeometry args={[a[3], a[4], a[5]]} />
          <meshStandardMaterial color="#2a140a" roughness={0.5} metalness={0.1} />
        </mesh>
      ))}

      {/* Pockets — 4 corners + 2 sides */}
      <Pocket x={-hw} z={-hl} />
      <Pocket x={hw} z={-hl} />
      <Pocket x={-hw} z={hl} />
      <Pocket x={hw} z={hl} />
      <Pocket x={-hw} z={0} r={0.045} />
      <Pocket x={hw} z={0} r={0.045} />

      {/* Diamond markers on rails */}
      {diamondsLong.map((z) => (
        <Diamond key={`dl1${z}`} x={hw + railT + 0.025} z={z} />
      ))}
      {diamondsLong.map((z) => (
        <Diamond key={`dl2${z}`} x={-(hw + railT + 0.025)} z={z} />
      ))}
      {diamondsShort.map((x) => (
        <Diamond key={`ds1${x}`} x={x} z={hl + railT + 0.025} />
      ))}
      {diamondsShort.map((x) => (
        <Diamond key={`ds2${x}`} x={x} z={-(hl + railT + 0.025)} />
      ))}
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/*  Ball — glossy PBR sphere + spin band                                       */
/* -------------------------------------------------------------------------- */
const BallMesh = ({ ball }: { ball: Ball }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const innerRef = useRef<THREE.Group>(null!);
  const rot = useRef(new THREE.Quaternion());
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(ball.pos.x, ball.pos.y, ball.pos.z);
    const omg = new THREE.Vector3(ball.omega.x, ball.omega.y, ball.omega.z);
    const angle = omg.length() * dt;
    if (angle > 1e-6 && innerRef.current) {
      const axis = omg.clone().normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      rot.current.multiplyQuaternions(q, rot.current);
      innerRef.current.quaternion.copy(rot.current);
    }
  });
  return (
    <group ref={groupRef}>
      <group ref={innerRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[ball.radius, 48, 48]} />
          <meshPhysicalMaterial
            color={ball.color}
            roughness={ball.pocketed ? 0.8 : 0.12}
            metalness={ball.pocketed ? 0 : 0.05}
            clearcoat={ball.pocketed ? 0 : 1}
            transparent={ball.pocketed}
            opacity={ball.pocketed ? 0.35 : 1}
          />
        </mesh>
        {!ball.pocketed && (
          <>
            <mesh>
              <torusGeometry args={[ball.radius * 0.99, ball.radius * 0.06, 10, 48]} />
              <meshStandardMaterial color="#0b0b0b" roughness={0.4} />
            </mesh>
            <mesh position={[0, ball.radius * 0.96, 0]}>
              <sphereGeometry args={[ball.radius * 0.16, 16, 16]} />
              <meshStandardMaterial color="#101010" />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

/* -------------------------------------------------------------------------- */
/*  Trails — history + predicted                                               */
/* -------------------------------------------------------------------------- */
const Trail = () => {
  const trail = useSim((s) => s.trail);
  const show = useSim((s) => s.showTrail);
  if (!show || trail.length < 2) return null;
  const pts = trail.map((p) => new THREE.Vector3(p.x, p.y + 0.001, p.z));
  return <Line points={pts} color="#4fc3f7" lineWidth={1.6} transparent opacity={0.85} />;
};

const Predicted = () => {
  const pred = useSim((s) => s.predicted);
  const show = useSim((s) => s.showPredicted);
  if (!show || pred.length < 2) return null;
  const pts = pred.map((p) => new THREE.Vector3(p.x, p.y + 0.001, p.z));
  return (
    <Line
      points={pts}
      color="#4fc3f7"
      lineWidth={1.2}
      dashed
      dashSize={0.025}
      gapSize={0.02}
      transparent
      opacity={0.6}
    />
  );
};

/* -------------------------------------------------------------------------- */
/*  Collision flash — expanding ring + impulse vector                          */
/* -------------------------------------------------------------------------- */
const CollisionFlash = ({ ev }: { ev: CollisionEvent }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const time = useSim((s) => s.time);
  const showImpulse = useSim((s) => s.toggles.impulse);
  const showLabels = useSim((s) => s.showLabels);
  const age = time - ev.bornAt;
  const t = Math.min(1, age / 1.2);
  const scale = 1 + t * 4;
  const opacity = 1 - t;
  return (
    <group position={[ev.pos.x, 0.005, ev.pos.z]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
        <ringGeometry args={[0.03, 0.04, 32]} />
        <meshBasicMaterial color="#ffeb3b" transparent opacity={opacity * 0.9} />
      </mesh>
      {showImpulse && (
        <VectorArrow
          origin={{ x: 0, y: 0.02, z: 0 }}
          vec={vscale(ev.normal, ev.magnitude)}
          color="#ff5252"
          scale={1.5}
          label="J"
          unit="kg·m/s"
          showLabel={showLabels && age < 0.6}
        />
      )}
    </group>
  );
};

const Collisions = () => {
  const evs = useSim((s) => s.collisions);
  return (
    <>
      {evs.map((e) => (
        <CollisionFlash key={e.id} ev={e} />
      ))}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Cushion bounce indicator — incoming / outgoing arrows + angle arc           */
/* -------------------------------------------------------------------------- */
const CushionBounceItem = ({ ev }: { ev: CushionBounceEvent }) => {
  const time = useSim((s) => s.time);
  const age = time - ev.bornAt;
  const opacity = Math.max(0, 1 - age / 2);
  const arrowLen = 0.08;
  const arcR = 0.045;

  const inEnd = new THREE.Vector3(ev.pos.x, ev.pos.y, ev.pos.z);
  const inStart = new THREE.Vector3(
    ev.pos.x - ev.preDir.x * arrowLen,
    ev.pos.y,
    ev.pos.z - ev.preDir.z * arrowLen,
  );
  const outEnd = new THREE.Vector3(
    ev.pos.x + ev.postDir.x * arrowLen,
    ev.pos.y,
    ev.pos.z + ev.postDir.z * arrowLen,
  );

  const fromDir = { x: -ev.preDir.x, y: 0, z: -ev.preDir.z };
  const toDir = { x: ev.postDir.x, y: 0, z: ev.postDir.z };
  const cosA = Math.max(-1, Math.min(1, vdot(fromDir, toDir)));
  const angleRad = Math.acos(cosA);
  const angleDeg = (angleRad * 180 / Math.PI).toFixed(1);
  const steps = 20;
  const arcPts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sinA = Math.sin(angleRad);
    if (sinA < 1e-6) {
      arcPts.push(new THREE.Vector3(ev.pos.x + fromDir.x * arcR, ev.pos.y + 0.005, ev.pos.z + fromDir.z * arcR));
    } else {
      const s0 = Math.sin((1 - t) * angleRad) / sinA;
      const s1 = Math.sin(t * angleRad) / sinA;
      arcPts.push(
        new THREE.Vector3(
          ev.pos.x + (s0 * fromDir.x + s1 * toDir.x) * arcR,
          ev.pos.y + 0.005,
          ev.pos.z + (s0 * fromDir.z + s1 * toDir.z) * arcR,
        ),
      );
    }
  }

  return (
    <group>
      <Line points={[inStart, inEnd]} color="#ff6b6b" lineWidth={1.5} transparent opacity={opacity} />
      <Line points={[inEnd, outEnd]} color="#4fc3f7" lineWidth={1.5} transparent opacity={opacity} />
      <Line points={arcPts} color="#ffd84d" lineWidth={1} transparent opacity={opacity} />
      {age < 1.5 && (
        <Html
          position={[
            ev.pos.x + (fromDir.x + toDir.x) * 0.035,
            ev.pos.y + 0.03,
            ev.pos.z + (fromDir.z + toDir.z) * 0.035,
          ]}
          style={{ pointerEvents: "none", opacity }}
        >
          <span style={{ color: "#ffd84d", fontSize: 10, fontFamily: "monospace", background: "rgba(0,0,0,0.6)", padding: "1px 4px", borderRadius: 3 }}>
            ∠{angleDeg}°
          </span>
        </Html>
      )}
    </group>
  );
};

const CushionBounces = () => {
  const evs = useSim((s) => s.cushionBounces);
  const visible = useSim((s) => s.showCushionAngles);
  if (!visible) return null;
  return (
    <>
      {evs.map((e) => (
        <CushionBounceItem key={e.id} ev={e} />
      ))}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Vector overlays on each ball                                               */
/* -------------------------------------------------------------------------- */
const Vectors = () => {
  const balls = useSim((s) => s.balls);
  const forces = useSim((s) => s.forces);
  const t = useSim((s) => s.toggles);
  const showLabels = useSim((s) => s.showLabels);
  return (
    <>
      {balls.map((b) => {
        const f = forces[b.id];
        const origin = { ...b.pos };
        return (
          <group key={b.id}>
            {t.velocity && (
              <VectorArrow
                origin={origin}
                vec={b.vel}
                color="#4fc3f7"
                scale={0.18}
                label="v"
                unit="m/s"
                showLabel={showLabels}
              />
            )}
            {t.acceleration && (
              <VectorArrow
                origin={origin}
                vec={b.acc}
                color="#ff8a65"
                scale={0.05}
                label="a"
                unit="m/s²"
                showLabel={showLabels}
              />
            )}
            {t.momentum && (
              <VectorArrow
                origin={origin}
                vec={vscale(b.vel, b.mass)}
                color="#ba68c8"
                scale={1.4}
                label="p"
                unit="kg·m/s"
                showLabel={showLabels}
              />
            )}
            {t.omega && (
              <VectorArrow
                origin={origin}
                vec={b.omega}
                color="#fff176"
                scale={0.025}
                label="ω"
                unit="rad/s"
                showLabel={showLabels}
              />
            )}
            {f && t.gravity && (
              <VectorArrow
                origin={origin}
                vec={f.gravity}
                color="#ef5350"
                scale={0.05}
                label="Fg"
                unit="N"
                showLabel={showLabels}
              />
            )}
            {f && t.normal && (
              <VectorArrow
                origin={origin}
                vec={f.normal}
                color="#81c784"
                scale={0.05}
                label="N"
                unit="N"
                showLabel={showLabels}
              />
            )}
            {f && t.friction && (
              <VectorArrow
                origin={origin}
                vec={f.friction}
                color="#ffb74d"
                scale={0.25}
                label="Ff"
                unit="N"
                showLabel={showLabels}
              />
            )}
          </group>
        );
      })}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Cue stick + aiming guide (visible only before the shot)                    */
/* -------------------------------------------------------------------------- */

const CUE_LENGTH = 1.45;

const CueStick = () => {
  const cue = useSim((s) => s.balls[0]);
  const aim = useSim((s) => s.aimAngle);
  const elevation = useSim((s) => s.cueElevation);
  const spinType = useSim((s) => s.controls.spinType);
  const phase = useSim((s) => s.shotPhase);
  const running = useSim((s) => s.running);
  const commit = useSim((s) => s.commitShot);
  const setPhase = useSim((s) => s.setShotPhase);

  const groupRef = useRef<THREE.Group>(null!);
  const pitchRef = useRef<THREE.Group>(null!);
  const pull = useRef(0);
  const phaseT = useRef(0);
  const PULL_DUR = 0.55;
  const STRIKE_DUR = 0.07;
  const MAX_PULL = 0.22;
  const smoothElev = useRef(elevation);

  useFrame((_, dt) => {
    if (phase === "pullback") {
      phaseT.current += dt;
      const t = Math.min(1, phaseT.current / PULL_DUR);
      pull.current = MAX_PULL * (1 - Math.pow(1 - t, 2));
      if (t >= 1) {
        phaseT.current = 0;
        setPhase("impact");
      }
    } else if (phase === "impact") {
      phaseT.current += dt;
      const t = Math.min(1, phaseT.current / STRIKE_DUR);
      pull.current = MAX_PULL * (1 - t);
      if (t >= 1) {
        phaseT.current = 0;
        commit();
      }
    } else {
      phaseT.current = 0;
      pull.current = 0;
    }

    if (!groupRef.current || !cue) return;
    const k = 1 - Math.exp(-dt * 14);
    smoothElev.current += (elevation - smoothElev.current) * k;
    const elev = smoothElev.current;

    const dx = Math.sin(aim);
    const dz = -Math.cos(aim);
    const r = cue.radius;
    const halfR = r * 0.5;
    let offRight = 0;
    let offUp = 0;
    switch (spinType) {
      case "top":    offUp = halfR; break;
      case "back":   offUp = -halfR; break;
      case "side":   offRight = halfR; break;
      case "masse":  offUp = -halfR; offRight = halfR * 0.6; break;
      case "swerve": offRight = halfR * 0.3; break;
    }
    const contactX = cue.pos.x - dx * r * Math.cos(elev) + offRight * Math.cos(aim);
    const contactY = cue.pos.y + r * Math.sin(elev) + offUp;
    const contactZ = cue.pos.z - dz * r * Math.cos(elev) + offRight * Math.sin(aim);

    groupRef.current.position.set(contactX, contactY, contactZ);
    groupRef.current.rotation.set(0, -aim, 0);
    if (pitchRef.current) {
      // negative X-rotation lifts the +Z (butt) end upward
      pitchRef.current.rotation.set(-elev, 0, 0);
      // pull-back slides cue away from the ball along its own axis
      pitchRef.current.position.set(0, 0, pull.current);
    }
  });

  if (running || !cue || phase === "fired") return null;

  return (
    <group ref={groupRef}>
      <group ref={pitchRef}>
        {/* tip (leather) */}
        <mesh position={[0, 0, 0.004]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0065, 0.0065, 0.008, 16]} />
          <meshStandardMaterial color="#1f4f9e" roughness={0.55} />
        </mesh>
        {/* ferrule (white) */}
        <mesh position={[0, 0, 0.018]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0068, 0.0072, 0.018, 16]} />
          <meshStandardMaterial color="#f4ead7" roughness={0.4} />
        </mesh>
        {/* shaft (maple) */}
        <mesh position={[0, 0, 0.027 + 0.55 / 2]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0072, 0.011, 0.55, 24]} />
          <meshStandardMaterial color="#e3c089" roughness={0.45} metalness={0.05} />
        </mesh>
        {/* joint ring */}
        <mesh position={[0, 0, 0.027 + 0.55]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0112, 0.0112, 0.012, 24]} />
          <meshStandardMaterial color="#d9d2c2" metalness={0.7} roughness={0.25} />
        </mesh>
        {/* butt (rosewood) */}
        <mesh
          position={[0, 0, 0.027 + 0.55 + 0.012 + (CUE_LENGTH - 0.55 - 0.027 - 0.012) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[0.011, 0.014, CUE_LENGTH - 0.55 - 0.027 - 0.012, 24]}
          />
          <meshStandardMaterial color="#2b1208" roughness={0.5} metalness={0.1} />
        </mesh>
        {/* wrap accent */}
        <mesh position={[0, 0, 0.027 + 0.55 + 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0125, 0.0125, 0.11, 24]} />
          <meshStandardMaterial color="#0e0e10" roughness={0.85} />
        </mesh>
        {/* bumper */}
        <mesh position={[0, 0, CUE_LENGTH + 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.014, 24]} />
          <meshStandardMaterial color="#0a0a0a" roughness={1} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * Predict first contact along current aim direction.
 * Returns either a ball hit or a cushion hit.
 */
type AimHit =
  | { kind: "ball"; t: number; contact: Vec3; postDir: Vec3; ghost: Vec3; target: Ball }
  | { kind: "cushion"; t: number; contact: Vec3 }
  | null;

const predictAim = (
  cue: Ball,
  others: Ball[],
  aim: number,
  hw: number,
  hl: number,
): AimHit => {
  const dx = Math.sin(aim);
  const dz = -Math.cos(aim);
  let best: AimHit = null;
  for (const o of others) {
    const ox = o.pos.x - cue.pos.x;
    const oz = o.pos.z - cue.pos.z;
    const tca = ox * dx + oz * dz;
    if (tca <= 0) continue;
    const d2 = ox * ox + oz * oz - tca * tca;
    const R = cue.radius + o.radius;
    if (d2 > R * R) continue;
    const t = tca - Math.sqrt(R * R - d2);
    if (t <= 0) continue;
    if (!best || t < best.t) {
      const ghost = {
        x: cue.pos.x + dx * t,
        y: cue.radius,
        z: cue.pos.z + dz * t,
      };
      const nlx = o.pos.x - ghost.x;
      const nlz = o.pos.z - ghost.z;
      const nl = Math.hypot(nlx, nlz) || 1;
      const nx = nlx / nl;
      const nz = nlz / nl;
      const contact = {
        x: ghost.x + nx * cue.radius,
        y: cue.radius,
        z: ghost.z + nz * cue.radius,
      };
      best = {
        kind: "ball",
        t,
        contact,
        ghost,
        postDir: { x: nx, y: 0, z: nz },
        target: o,
      };
    }
  }
  if (best) return best;
  // cushion intersection
  const tx = dx > 0
    ? (hw - cue.radius - cue.pos.x) / dx
    : dx < 0
      ? (-hw + cue.radius - cue.pos.x) / dx
      : Infinity;
  const tz = dz > 0
    ? (hl - cue.radius - cue.pos.z) / dz
    : dz < 0
      ? (-hl + cue.radius - cue.pos.z) / dz
      : Infinity;
  const t = Math.max(0, Math.min(tx, tz));
  if (!isFinite(t)) return null;
  return {
    kind: "cushion",
    t,
    contact: {
      x: cue.pos.x + dx * t,
      y: cue.radius,
      z: cue.pos.z + dz * t,
    },
  };
};

const AimingGuide = () => {
  const balls = useSim((s) => s.balls);
  const aim = useSim((s) => s.aimAngle);
  const phase = useSim((s) => s.shotPhase);
  const running = useSim((s) => s.running);
  const world = useSim((s) => s.world);
  const showLabels = useSim((s) => s.showLabels);

  if (running || phase === "fired" || !balls.length) return null;
  const cue = balls[0];
  const others = balls.slice(1);
  const hit = predictAim(cue, others, aim, world.tableHalfWidth, world.tableHalfLength);
  if (!hit) return null;

  const dx = Math.sin(aim);
  const dz = -Math.cos(aim);
  const linePts = [
    new THREE.Vector3(cue.pos.x, cue.pos.y + 0.001, cue.pos.z),
    new THREE.Vector3(hit.contact.x, cue.pos.y + 0.001, hit.contact.z),
  ];

  // shot direction arrow (short, attached to ball, current aim)
  const arrowLen = 0.18;
  const dirArrowEnd = {
    x: cue.pos.x + dx * arrowLen,
    y: cue.pos.y + 0.001,
    z: cue.pos.z + dz * arrowLen,
  };
  const dirArrowPts = [
    new THREE.Vector3(cue.pos.x, cue.pos.y + 0.001, cue.pos.z),
    new THREE.Vector3(dirArrowEnd.x, dirArrowEnd.y, dirArrowEnd.z),
  ];
  const arrowHeadDir = new THREE.Vector3(dx, 0, dz);
  const arrowQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    arrowHeadDir,
  );
  const arrowEuler = new THREE.Euler().setFromQuaternion(arrowQuat);

  return (
    <group>
      {/* aim guide line */}
      <Line
        points={linePts}
        color="#ffffff"
        lineWidth={1.4}
        dashed
        dashSize={0.04}
        gapSize={0.025}
        transparent
        opacity={0.55}
      />

      {/* shot direction arrow (solid, near ball) */}
      <Line points={dirArrowPts} color="#ff9b3d" lineWidth={3} />
      <mesh
        position={[dirArrowEnd.x, dirArrowEnd.y, dirArrowEnd.z]}
        rotation={[arrowEuler.x, arrowEuler.y, arrowEuler.z]}
      >
        <coneGeometry args={[0.018, 0.05, 16]} />
        <meshBasicMaterial color="#ff9b3d" />
      </mesh>

      {hit.kind === "ball" && (
        <>
          {/* ghost cue ball at contact */}
          <mesh position={[hit.ghost.x, hit.ghost.y, hit.ghost.z]}>
            <sphereGeometry args={[cue.radius * 1.005, 24, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.18} wireframe />
          </mesh>
          {/* contact marker */}
          <mesh
            position={[hit.contact.x, 0.003, hit.contact.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.008, 0.014, 24]} />
            <meshBasicMaterial color="#ff5252" />
          </mesh>
          {/* post-collision target arrow */}
          <VectorArrow
            origin={{ x: hit.target.pos.x, y: hit.target.pos.y, z: hit.target.pos.z }}
            vec={vscale(hit.postDir, 0.4)}
            color="#ff5252"
            scale={1}
            label="post"
            unit=""
            showLabel={showLabels}
          />
          {showLabels && (
            <Html
              position={[hit.contact.x, 0.06, hit.contact.z]}
              center
              distanceFactor={1.4}
              style={{ pointerEvents: "none" }}
            >
              <div
                className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] leading-none"
                style={{
                  background: "rgba(8,12,20,0.78)",
                  color: "#ff5252",
                  border: "1px solid #ff525255",
                  whiteSpace: "nowrap",
                }}
              >
                contact d={hit.t.toFixed(2)} m
              </div>
            </Html>
          )}
        </>
      )}
      {hit.kind === "cushion" && (
        <mesh
          position={[hit.contact.x, 0.003, hit.contact.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.01, 0.018, 24]} />
          <meshBasicMaterial color="#4fc3f7" />
        </mesh>
      )}
    </group>
  );
};

/**
 * Invisible interaction plane for mouse-drag aiming.
 * Active only when cue is visible (not running, idle phase).
 */
const AIM_SENSITIVITY = 0.008; // radians per pixel of horizontal drag
const ELEV_SENSITIVITY = 0.006; // radians per pixel of vertical drag (Shift)

const AimPlane = () => {
  const cue = useSim((s) => s.balls[0]);
  const aim = useSim((s) => s.aimAngle);
  const setAim = useSim((s) => s.setAimAngle);
  const elev = useSim((s) => s.cueElevation);
  const setElev = useSim((s) => s.setCueElevation);
  const phase = useSim((s) => s.shotPhase);
  const running = useSim((s) => s.running);
  const world = useSim((s) => s.world);
  const shoot = useSim((s) => s.shoot);
  const [dragging, setDragging] = useState(false);
  const dragDist = useRef(0);
  const aimRef = useRef(aim);
  const elevRef = useRef(elev);
  aimRef.current = aim;
  elevRef.current = elev;
  const { gl } = useThree();

  useEffect(() => {
    if (dragging) gl.domElement.style.cursor = "grabbing";
    else gl.domElement.style.cursor = phase === "idle" && !running ? "crosshair" : "";
  }, [dragging, gl, phase, running]);

  if (running || phase !== "idle" || !cue) return null;

  const normalize = (a: number) => {
    let x = a;
    while (x > Math.PI) x -= Math.PI * 2;
    while (x <= -Math.PI) x += Math.PI * 2;
    return x;
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.002, 0]}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        (e.target as Element)?.setPointerCapture?.(e.pointerId);
        dragDist.current = 0;
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        e.stopPropagation();
        const native = e.nativeEvent as PointerEvent;
        const mx = native.movementX || 0;
        const my = native.movementY || 0;
        dragDist.current += Math.abs(mx) + Math.abs(my);
        // Shift + vertical drag = elevation; otherwise horizontal drag = aim
        if (native.shiftKey) {
          if (my) setElev(elevRef.current - my * ELEV_SENSITIVITY);
        } else {
          if (mx) setAim(normalize(aimRef.current + mx * AIM_SENSITIVITY));
        }
      }}
      onPointerUp={(e) => {
        (e.target as Element)?.releasePointerCapture?.(e.pointerId);
        const wasClick = dragDist.current < 4;
        setDragging(false);
        if (wasClick) shoot();
      }}
      onPointerLeave={() => setDragging(false)}
    >
      <planeGeometry args={[world.tableHalfWidth * 2.4, world.tableHalfLength * 2.4]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

/* -------------------------------------------------------------------------- */
/*  HUD — current aim angle readout                                            */
/* -------------------------------------------------------------------------- */
export const AimHUD = () => {
  const aim = useSim((s) => s.aimAngle);
  const elev = useSim((s) => s.cueElevation);
  const setElev = useSim((s) => s.setCueElevation);
  const phase = useSim((s) => s.shotPhase);
  const running = useSim((s) => s.running);
  const force = useSim((s) => s.controls.impactForce);
  const reset = useSim((s) => s.reset);
  const blocked = running || phase !== "idle";
  let deg = (aim * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  const elevDeg = (elev * 180) / Math.PI;
  const FMIN = 5;
  const FMAX = 200;
  const pct = Math.round(((force - FMIN) / (FMAX - FMIN)) * 100);
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-2">
      <div className="rounded-md border border-cyan-400/30 bg-slate-900/80 px-3 py-2 font-mono text-[11px] text-cyan-300 shadow-lg backdrop-blur">
        <div className="flex flex-wrap gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-cyan-400/70">Aim</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">{deg.toFixed(1)}°</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-emerald-300/80">Elevation</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-200">
              {elevDeg.toFixed(1)}°
            </div>
            <div className="pointer-events-auto mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setElev(elev - (Math.PI / 180) * 2)}
                className="rounded border border-emerald-400/40 bg-emerald-950/50 px-1.5 text-[10px] text-emerald-200 hover:bg-emerald-900/60"
                title="Lower butt (−2°)"
              >
                −
              </button>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={Math.round(elevDeg)}
                onChange={(e) => setElev((parseFloat(e.target.value) * Math.PI) / 180)}
                className="h-1 w-20 cursor-pointer accent-emerald-400"
              />
              <button
                type="button"
                onClick={() => setElev(elev + (Math.PI / 180) * 2)}
                className="rounded border border-emerald-400/40 bg-emerald-950/50 px-1.5 text-[10px] text-emerald-200 hover:bg-emerald-900/60"
                title="Raise butt (+2°)"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-amber-300/80">Power</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-amber-200">
              {pct}% <span className="text-[9px] text-amber-300/60">({force.toFixed(0)} N)</span>
            </div>
            <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-1.5 text-[9px] leading-tight text-slate-400">
          {blocked
            ? "Balls in motion — wait for rest"
            : "Drag = aim · Shift+drag = elevation · Wheel = power · Click = shoot"}
        </div>
      </div>
      <button
        type="button"
        onClick={reset}
        className="pointer-events-auto self-start rounded-md border border-rose-400/40 bg-rose-950/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-rose-200 shadow hover:bg-rose-900/70"
      >
        Reset Table
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Physics ticker                                                             */
/* -------------------------------------------------------------------------- */
const Ticker = () => {
  const step = useSim((s) => s.step);
  const running = useSim((s) => s.running);
  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(delta, 1 / 60);
    const sub = 4;
    for (let i = 0; i < sub; i++) step(dt / sub);
  });
  return null;
};

/* -------------------------------------------------------------------------- */
/*  Camera rig — smooth lerp between modes                                     */
/* -------------------------------------------------------------------------- */
const cameraTargets: Record<CameraMode, { pos: [number, number, number]; look: [number, number, number] }> = {
  orbit: { pos: [1.7, 1.4, 1.8], look: [0, 0, 0] },
  top: { pos: [0.0, 2.4, 0.001], look: [0, 0, 0] },
  side: { pos: [2.4, 0.35, 0], look: [0, 0.05, 0] },
  follow: { pos: [0, 0.35, 0.9], look: [0, 0, 0] },
  analysis: { pos: [1.2, 0.9, 1.4], look: [0, 0, 0] },
};

const CameraRig = ({ controls }: { controls: React.MutableRefObject<any> }) => {
  const mode = useSim((s) => s.cameraMode);
  const ball = useSim((s) => s.balls[0]);
  const { camera } = useThree();
  const tmpPos = useRef(new THREE.Vector3());
  const tmpLook = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const t = cameraTargets[mode];
    if (!t) return;
    let [tx, ty, tz] = t.pos;
    let [lx, ly, lz] = t.look;
    if (mode === "follow" && ball) {
      tx = ball.pos.x - 0.4;
      ty = ball.pos.y + 0.35;
      tz = ball.pos.z + 0.6;
      lx = ball.pos.x;
      ly = ball.pos.y;
      lz = ball.pos.z;
    }
    if (mode !== "orbit") {
      // disable user orbit drag in fixed modes
      if (controls.current) controls.current.enabled = false;
      const k = 1 - Math.exp(-dt * 4);
      tmpPos.current.set(tx, ty, tz);
      camera.position.lerp(tmpPos.current, k);
      tmpLook.current.set(lx, ly, lz);
      if (controls.current) {
        controls.current.target.lerp(tmpLook.current, k);
        controls.current.update();
      } else {
        camera.lookAt(tmpLook.current);
      }
    } else {
      if (controls.current) controls.current.enabled = true;
    }
  });
  return null;
};

/* -------------------------------------------------------------------------- */
/*  Scene                                                                      */
/* -------------------------------------------------------------------------- */
export const Scene3D = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const balls = useSim((s) => s.balls);
  const controlsRef = useRef<any>(null);

  if (!mounted) {
    return <div className="h-full w-full" />;
  }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [1.7, 1.4, 1.8], fov: 42, near: 0.05, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={["#070a10"]} />
      <fog attach="fog" args={["#070a10", 5, 14]} />

      {/* Studio lighting */}
      <ambientLight intensity={0.25} />
      <hemisphereLight args={["#9ccfff", "#0a0f18", 0.35]} />
      <directionalLight
        position={[2.5, 4.5, 2]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-2.5, 3, -2]} intensity={0.45} color="#88b4ff" />
      <spotLight
        position={[0, 3, 0]}
        angle={0.7}
        penumbra={0.6}
        intensity={1.1}
        color="#ffe9c2"
        castShadow={false}
      />
      <Table />
      {balls.map((b) => (
        <BallMesh key={b.id} ball={b} />
      ))}

      <Trail />
      <Predicted />
      <Collisions />
      <CushionBounces />
      <Vectors />
      <AimingGuide />
      <CueStick />
      <AimPlane />

      {/* Engineering reference grid below the table */}
      <Grid
        args={[6, 6]}
        position={[0, -0.085, 0]}
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#1c2a3a"
        sectionSize={0.5}
        sectionThickness={1}
        sectionColor="#2b4a6a"
        fadeDistance={6}
        fadeStrength={1.2}
        infiniteGrid={false}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.6}
        maxDistance={5}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraRig controls={controlsRef} />
      <Ticker />
    </Canvas>
  );
};
