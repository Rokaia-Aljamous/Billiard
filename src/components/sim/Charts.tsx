import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSim } from "@/store/simStore";

const Chart = ({
  title,
  dataKey,
  color,
  unit,
}: {
  title: string;
  dataKey: string;
  color: string;
  unit: string;
}) => {
  const samples = useSim((s) => s.samples);
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3 backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={samples} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="t"
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <YAxis stroke="#64748b" fontSize={10} width={36} />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid #334155",
                fontSize: 11,
              }}
              labelFormatter={(l) => `t=${l}s`}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const Charts = () => (
  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
    <Chart title="Velocity vs Time" dataKey="speed" color="#4fc3f7" unit="m/s" />
    <Chart title="Acceleration vs Time" dataKey="accel" color="#ff8a65" unit="m/s²" />
    <Chart title="Momentum vs Time" dataKey="momentum" color="#ba68c8" unit="kg·m/s" />
    <Chart title="Angular ω vs Time" dataKey="omega" color="#fff176" unit="rad/s" />
    <Chart title="Total Energy vs Time" dataKey="energy" color="#81c784" unit="J" />
  </div>
);
