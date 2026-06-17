import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Line,
  ContactShadows,
  Html,
  SoftShadows,
  Grid,
} from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useSim, CameraMode, CollisionEvent } from "@/store/simStore";
import { Ball, Vec3, vlen, vnorm, vscale } from "@/physics/types";

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
      {/* Head string line */}
      <mesh position={[0, 0.0008, hl * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[hw * 2 - 0.02, 0.002]} />
        <meshBasicMaterial color="#e8d99a" transparent opacity={0.35} />
      </mesh>
      {/* Foot spot */}
      <mesh position={[0, 0.0009, -hl * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial color="#e8d99a" />
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
            roughness={0.12}
            metalness={0.05}
            clearcoat={1}
            clearcoatRoughness={0.05}
            reflectivity={0.6}
          />
        </mesh>
        {/* Spin band — equator, helps eye track rotation */}
        <mesh>
          <torusGeometry args={[ball.radius * 0.99, ball.radius * 0.06, 10, 48]} />
          <meshStandardMaterial color="#0b0b0b" roughness={0.4} />
        </mesh>
        {/* Pole dot */}
        <mesh position={[0, ball.radius * 0.96, 0]}>
          <sphereGeometry args={[ball.radius * 0.16, 16, 16]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
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
  return <Line points={pts} color="#ffd84d" lineWidth={1.6} transparent opacity={0.85} />;
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
  const balls = useSim((s) => s.balls);
  const controlsRef = useRef<any>(null);
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
      <SoftShadows size={20} samples={16} focus={0.7} />
      <Environment preset="studio" />

      <Table />
      {balls.map((b) => (
        <BallMesh key={b.id} ball={b} />
      ))}

      <ContactShadows
        position={[0, 0.0009, 0]}
        opacity={0.55}
        scale={4}
        blur={2.4}
        far={1}
        resolution={1024}
      />

      <Trail />
      <Predicted />
      <Collisions />
      <Vectors />

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
