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
  if (!ball) return null;
  const stats = computeStats(ball);
  const totalE = stats.ke + stats.re;
  return (
    <div className="space-y-1 rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
        Live Measurements — Ball #{ball.id}
      </h3>
      <Row label="t" value={fmt(time)} unit="s" />
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
        label="Acceleration"
        value={`${fmt(ball.acc.x)}, ${fmt(ball.acc.y)}, ${fmt(ball.acc.z)}`}
        unit="m/s²"
      />
      <Row
        label="Angular ω"
        value={`${fmt(ball.omega.x)}, ${fmt(ball.omega.y)}, ${fmt(ball.omega.z)}`}
        unit="rad/s"
      />
      <Row label="|p| momentum" value={fmt(vlen(stats.p))} unit="kg·m/s" />
      <Row label="|L| ang. momentum" value={fmt(vlen(stats.L), 5)} unit="kg·m²/s" />
      <Row label="Eₖ translational" value={fmt(stats.ke, 4)} unit="J" />
      <Row label="Eᵣ rotational" value={fmt(stats.re, 4)} unit="J" />
      <Row label="E total" value={fmt(totalE, 4)} unit="J" />
      {forces && (
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
