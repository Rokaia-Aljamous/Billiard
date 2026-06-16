import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSim, VectorToggles } from "@/store/simStore";

const SliderRow = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className="font-mono text-xs text-foreground">
        {value.toFixed(step < 0.01 ? 4 : step < 1 ? 3 : 1)}
        {unit && <span className="ml-1 text-muted-foreground">{unit}</span>}
      </span>
    </div>
    <Slider
      value={[value]}
      onValueChange={(v) => onChange(v[0])}
      min={min}
      max={max}
      step={step}
    />
  </div>
);

const VECTOR_KEYS: { key: keyof VectorToggles; label: string; color: string }[] = [
  { key: "velocity", label: "Velocity", color: "#4fc3f7" },
  { key: "acceleration", label: "Acceleration", color: "#ff8a65" },
  { key: "momentum", label: "Momentum", color: "#ba68c8" },
  { key: "omega", label: "Angular ω", color: "#fff176" },
  { key: "gravity", label: "Gravity", color: "#ef5350" },
  { key: "normal", label: "Normal", color: "#81c784" },
  { key: "friction", label: "Friction", color: "#ffb74d" },
];

export const Controls = () => {
  const c = useSim((s) => s.controls);
  const set = useSim((s) => s.setControl);
  const toggles = useSim((s) => s.toggles);
  const setToggle = useSim((s) => s.setToggle);
  const running = useSim((s) => s.running);
  const setRunning = useSim((s) => s.setRunning);
  const reset = useSim((s) => s.reset);
  const shoot = useSim((s) => s.shoot);

  return (
    <div className="space-y-5 rounded-lg border border-border/50 bg-card/50 p-4 backdrop-blur">
      <div className="flex flex-wrap gap-2">
        <Button onClick={shoot} variant="default" size="sm">
          Apply Cue Impact
        </Button>
        <Button
          onClick={() => setRunning(!running)}
          variant="secondary"
          size="sm"
        >
          {running ? "Pause" : "Play"}
        </Button>
        <Button onClick={reset} variant="outline" size="sm">
          Reset
        </Button>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Ball Properties
        </h4>
        <SliderRow
          label="Mass"
          value={c.mass}
          onChange={(v) => set("mass", v)}
          min={0.05}
          max={0.5}
          step={0.01}
          unit="kg"
        />
        <SliderRow
          label="Radius"
          value={c.radius}
          onChange={(v) => set("radius", v)}
          min={0.015}
          max={0.05}
          step={0.001}
          unit="m"
        />
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Surface & Collisions
        </h4>
        <SliderRow
          label="Kinetic Friction μ"
          value={c.muKinetic}
          onChange={(v) => set("muKinetic", v)}
          min={0}
          max={0.6}
          step={0.01}
        />
        <SliderRow
          label="Rolling Resistance"
          value={c.muRolling}
          onChange={(v) => set("muRolling", v)}
          min={0}
          max={0.05}
          step={0.001}
        />
        <SliderRow
          label="Restitution e"
          value={c.restitution}
          onChange={(v) => set("restitution", v)}
          min={0}
          max={1}
          step={0.01}
        />
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Cue Impact
        </h4>
        <SliderRow
          label="Impact Force"
          value={c.impactForce}
          onChange={(v) => set("impactForce", v)}
          min={5}
          max={200}
          step={1}
          unit="N"
        />
        <SliderRow
          label="Impact Angle"
          value={c.impactAngle}
          onChange={(v) => set("impactAngle", v)}
          min={-90}
          max={90}
          step={1}
          unit="°"
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Spin Type</Label>
          <Select
            value={c.spinType}
            onValueChange={(v) => set("spinType", v as typeof c.spinType)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (center hit)</SelectItem>
              <SelectItem value="top">Top Spin</SelectItem>
              <SelectItem value="back">Back Spin (Draw)</SelectItem>
              <SelectItem value="side">Side Spin (English)</SelectItem>
              <SelectItem value="masse">Massé / Swerve</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Vector Overlays
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {VECTOR_KEYS.map((vk) => (
            <label
              key={vk.key}
              className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5"
            >
              <span className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: vk.color }}
                />
                {vk.label}
              </span>
              <Switch
                checked={toggles[vk.key]}
                onCheckedChange={(v) => setToggle(vk.key, v)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
