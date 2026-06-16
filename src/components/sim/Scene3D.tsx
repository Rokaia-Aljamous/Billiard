import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useSim } from "@/store/simStore";
import { Ball, Vec3, vlen, vnorm, vscale } from "@/physics/types";

const VectorArrow = ({
  origin,
  vec,
  color,
  scale = 0.3,
}: {
  origin: Vec3;
  vec: Vec3;
  color: string;
  scale?: number;
}) => {
  const len = vlen(vec) * scale;
  const dir = vnorm(vec);
  const tip = {
    x: origin.x + dir.x * len,
    y: origin.y + dir.y * len,
    z: origin.z + dir.z * len,
  };
  const points = useMemo(
    () => [
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(tip.x, tip.y, tip.z),
    ],
    [origin.x, origin.y, origin.z, tip.x, tip.y, tip.z],
  );
  if (len < 0.01) return null;
  const headDir = new THREE.Vector3(dir.x, dir.y, dir.z);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), headDir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <group>
      <Line points={points} color={color} lineWidth={2} />
      <mesh position={[tip.x, tip.y, tip.z]} rotation={[euler.x, euler.y, euler.z]}>
        <coneGeometry args={[0.012, 0.04, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

const Table = () => {
  const w = useSim((s) => s.world);
  return (
    <group>
      {/* cloth */}
      <mesh receiveShadow position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w.tableHalfWidth * 2, w.tableHalfLength * 2]} />
        <meshStandardMaterial color="#0c5d3a" roughness={0.9} />
      </mesh>
      {/* cushions */}
      {[
        [w.tableHalfWidth, 0.03, 0, 0.04, 0.06, w.tableHalfLength * 2],
        [-w.tableHalfWidth, 0.03, 0, 0.04, 0.06, w.tableHalfLength * 2],
        [0, 0.03, w.tableHalfLength, w.tableHalfWidth * 2, 0.06, 0.04],
        [0, 0.03, -w.tableHalfLength, w.tableHalfWidth * 2, 0.06, 0.04],
      ].map((args, i) => (
        <mesh key={i} position={[args[0], args[1], args[2]]} castShadow receiveShadow>
          <boxGeometry args={[args[3], args[4], args[5]]} />
          <meshStandardMaterial color="#1a3d2a" />
        </mesh>
      ))}
      {/* rails */}
      <mesh position={[0, 0.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, 0.001, 4]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
};

const BallMesh = ({ ball }: { ball: Ball }) => {
  const ref = useRef<THREE.Mesh>(null!);
  const rot = useRef(new THREE.Quaternion());
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.set(ball.pos.x, ball.pos.y, ball.pos.z);
    const omg = new THREE.Vector3(ball.omega.x, ball.omega.y, ball.omega.z);
    const angle = omg.length() * dt;
    if (angle > 1e-6) {
      const axis = omg.clone().normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      rot.current.multiplyQuaternions(q, rot.current);
      ref.current.quaternion.copy(rot.current);
    }
  });
  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[ball.radius, 32, 32]} />
      <meshStandardMaterial color={ball.color} roughness={0.3} metalness={0.05} />
      {/* stripe to visualize spin */}
      <mesh>
        <torusGeometry args={[ball.radius * 0.95, ball.radius * 0.07, 8, 32]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </mesh>
  );
};

const Trail = () => {
  const trail = useSim((s) => s.trail);
  if (trail.length < 2) return null;
  const pts = trail.map((p) => new THREE.Vector3(p.x, p.y + 0.001, p.z));
  return <Line points={pts} color="#ffd84d" lineWidth={1.5} dashed={false} />;
};

const Ticker = () => {
  const step = useSim((s) => s.step);
  const running = useSim((s) => s.running);
  useFrame((_, delta) => {
    if (!running) return;
    const dt = Math.min(delta, 1 / 60);
    // substeps for stability
    const sub = 4;
    for (let i = 0; i < sub; i++) step(dt / sub);
  });
  return null;
};

const Vectors = () => {
  const balls = useSim((s) => s.balls);
  const forces = useSim((s) => s.forces);
  const t = useSim((s) => s.toggles);
  return (
    <>
      {balls.map((b) => {
        const f = forces[b.id];
        const origin = { ...b.pos };
        return (
          <group key={b.id}>
            {t.velocity && (
              <VectorArrow origin={origin} vec={b.vel} color="#4fc3f7" scale={0.15} />
            )}
            {t.acceleration && (
              <VectorArrow origin={origin} vec={b.acc} color="#ff8a65" scale={0.04} />
            )}
            {t.momentum && (
              <VectorArrow
                origin={origin}
                vec={vscale(b.vel, b.mass)}
                color="#ba68c8"
                scale={1.2}
              />
            )}
            {t.omega && (
              <VectorArrow origin={origin} vec={b.omega} color="#fff176" scale={0.02} />
            )}
            {f && t.gravity && (
              <VectorArrow origin={origin} vec={f.gravity} color="#ef5350" scale={0.04} />
            )}
            {f && t.normal && (
              <VectorArrow origin={origin} vec={f.normal} color="#81c784" scale={0.04} />
            )}
            {f && t.friction && (
              <VectorArrow origin={origin} vec={f.friction} color="#ffb74d" scale={0.2} />
            )}
          </group>
        );
      })}
    </>
  );
};

export const Scene3D = () => {
  const balls = useSim((s) => s.balls);
  return (
    <Canvas shadows camera={{ position: [1.5, 1.4, 1.8], fov: 45 }}>
      <color attach="background" args={["#0b0f17"]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[2, 4, 2]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Environment preset="city" />
      <Table />
      {balls.map((b) => (
        <BallMesh key={b.id} ball={b} />
      ))}
      <Trail />
      <Vectors />
      <OrbitControls makeDefault target={[0, 0, 0]} />
      <Ticker />
      <gridHelper args={[4, 20, "#1e293b", "#1e293b"]} position={[0, -0.01, 0]} />
    </Canvas>
  );
};
