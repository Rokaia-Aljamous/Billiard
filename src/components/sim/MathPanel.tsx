import { computeStats, useSim } from "@/store/simStore";
import { vlen } from "@/physics/types";

const Row = ({ label, value, unit }: { label: string; value: string; unit?: string }) => (
  <div className="flex items-baseline justify-between border-b border-border/40 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-foreground">
      {value}
      {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
    </span>
  </div>
);

const fmt = (n: number, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : "—");

export const MathPanel = () => {
  const ball = useSim((s) => s.balls[0]);
  const forces = useSim((s) => s.forces[ball?.id ?? -1]);
  const time = useSim((s) => s.time);
  const stats = useSim((s) => s.systemStats);
  const collisions = useSim((s) => s.collisions);
  const pocketEvents = useSim((s) => s.pocketEvents);
  const balls = useSim((s) => s.balls);

  if (!ball) return null;

  const lastCollision = collisions.length > 0 ? collisions[collisions.length - 1] : null;
  const lastPocket = pocketEvents.length > 0 ? pocketEvents[pocketEvents.length - 1] : null;

  const bStats = ball && !ball.pocketed ? computeStats(ball) : null;

  // Find first active ball for slip/roll info
  const activeB = balls.find((b) => !b.pocketed);

  return (
    <div className="space-y-1 rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        Live Measurements — Ball #{ball.id}
      </h3>
      <Row label="t" value={fmt(time)} unit="s" />
      {!ball.pocketed && bStats && (
        <>
          <Row
            label="Position (x,y,z)"
            value={`${fmt(ball.pos.x)}, ${fmt(ball.pos.y)}, ${fmt(ball.pos.z)}`}
            unit="m"
          />
          <Row
            label="Velocity"
            value={`${fmt(ball.vel.x)}, ${fmt(ball.vel.y)}, ${fmt(ball.vel.z)}`}
            unit="m/s"
          />
          <Row label="|v|" value={fmt(vlen(ball.vel))} unit="m/s" />
          <Row
            label="Angular ω"
            value={`${fmt(ball.omega.x)}, ${fmt(ball.omega.y)}, ${fmt(ball.omega.z)}`}
            unit="rad/s"
          />
          <Row label="|p| momentum" value={fmt(vlen(bStats.p))} unit="kg·m/s" />
          <Row label="|L| ang. momentum" value={fmt(vlen(bStats.L), 5)} unit="kg·m²/s" />
          <Row label="Eₖ translational" value={fmt(bStats.ke, 4)} unit="J" />
          <Row label="Eᵣ rotational" value={fmt(bStats.re, 4)} unit="J" />
        </>
      )}
      {ball.pocketed && (
        <Row label="Status" value="POCKETED" />
      )}

      <div className="mt-3 border-t border-border/40 pt-2">
        <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          System Analysis
        </h4>
        <Row label="Active balls" value={String(stats.activeBalls)} />
        <Row label="Pocketed" value={String(stats.pocketedCount)} />
        <Row label="E total system" value={fmt(stats.totalEnergy, 4)} unit="J" />
        <Row label="E lost (friction)" value={fmt(stats.energyLost, 4)} unit="J" />
        <Row label="Total |p|" value={fmt(stats.totalMomentum, 4)} unit="kg·m/s" />
        <Row label="Total |L|" value={fmt(stats.totalAngularMomentum, 5)} unit="kg·m²/s" />
        {activeB && (
          <>
            <Row label="Slip distance" value={fmt(activeB.slipDistance, 4)} unit="m" />
            <Row label="Roll time" value={fmt(activeB.rollTime, 3)} unit="s" />
          </>
        )}
        {lastCollision && (
          <Row label="Last collision ∠" value={`${fmt(lastCollision.angleDeg, 1)}°`} />
        )}
        {lastPocket && (
          <Row label="Last pocket" value={`#${lastPocket.ballId} @ ${lastPocket.pocketId}`} />
        )}
      </div>

      {forces && ball && !ball.pocketed && (
        <>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Forces (N)
          </div>
          <Row label="Gravity |F|" value={fmt(vlen(forces.gravity), 3)} />
          <Row label="Normal |N|" value={fmt(vlen(forces.normal), 3)} />
          <Row label="Friction |Ff|" value={fmt(vlen(forces.friction), 3)} />
          <Row label="Torque |τ|" value={fmt(vlen(forces.torque), 5)} unit="N·m" />
        </>
      )}
    </div>
  );
};
