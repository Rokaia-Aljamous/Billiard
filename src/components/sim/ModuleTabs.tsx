import { GameMode, useSim } from "@/store/simStore";
import { cn } from "@/lib/utils";

const MODULES: { id: GameMode; label: string; desc: string }[] = [
  { id: "single", label: "1. Single Ball Motion", desc: "Sliding → rolling → stop via friction." },
  { id: "rotation", label: "2. Rotational Dynamics", desc: "Torque, ω, α, spin vectors." },
  { id: "collision", label: "3. Ball Collision", desc: "Momentum & energy transfer." },
  { id: "cushion", label: "4. Cushion Rebound", desc: "Incidence = reflection, restitution." },
  { id: "jump", label: "5. Jump Shot", desc: "Projectile trajectory in 3D." },
  { id: "8ball", label: "6. 8 Ball", desc: "Full rack, solids/stripes, pocket 8 last." },
  { id: "9ball", label: "7. 9 Ball", desc: "Hit lowest first, 9 wins." },
  { id: "snooker", label: "8. Snooker", desc: "15 reds + colors, points scoring." },
  { id: "carom", label: "9. Carom", desc: "No pockets, ricochet scoring." },
];

export const ModuleTabs = () => {
  const mode = useSim((s) => s.mode);
  const setMode = useSim((s) => s.setMode);
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-5 lg:grid-cols-9">
      {MODULES.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          className={cn(
            "rounded-lg border px-2 py-2 text-left transition-colors",
            mode === m.id
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border/50 bg-card/30 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <div className="text-[10px] font-semibold leading-tight">{m.label}</div>
          <div className="mt-0.5 text-[9px] leading-tight opacity-80">{m.desc}</div>
        </button>
      ))}
    </div>
  );
};
