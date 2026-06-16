import { CameraMode, useSim } from "@/store/simStore";
import { cn } from "@/lib/utils";
import {
  Orbit,
  ArrowDownToLine,
  ArrowRightToLine,
  Crosshair,
  Microscope,
  Route as RouteIcon,
  Spline,
  Tag,
} from "lucide-react";

const CAMERAS: { id: CameraMode; label: string; Icon: any }[] = [
  { id: "orbit", label: "Free Orbit", Icon: Orbit },
  { id: "top", label: "Top", Icon: ArrowDownToLine },
  { id: "side", label: "Side", Icon: ArrowRightToLine },
  { id: "follow", label: "Follow Ball", Icon: Crosshair },
  { id: "analysis", label: "Analysis", Icon: Microscope },
];

const Pill = ({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    title={title}
    onClick={onClick}
    className={cn(
      "flex h-7 items-center gap-1.5 rounded-md border px-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
      active
        ? "border-primary/60 bg-primary/15 text-primary"
        : "border-border/50 bg-card/70 text-muted-foreground hover:border-border hover:text-foreground",
    )}
  >
    {children}
  </button>
);

export const SceneToolbar = () => {
  const cam = useSim((s) => s.cameraMode);
  const setCam = useSim((s) => s.setCameraMode);
  const showTrail = useSim((s) => s.showTrail);
  const setShowTrail = useSim((s) => s.setShowTrail);
  const showPredicted = useSim((s) => s.showPredicted);
  const setShowPredicted = useSim((s) => s.setShowPredicted);
  const showLabels = useSim((s) => s.showLabels);
  const setShowLabels = useSim((s) => s.setShowLabels);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-background/70 p-1.5 backdrop-blur">
        {CAMERAS.map(({ id, label, Icon }) => (
          <Pill key={id} active={cam === id} onClick={() => setCam(id)} title={label}>
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </Pill>
        ))}
      </div>
      <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-background/70 p-1.5 backdrop-blur">
        <Pill active={showTrail} onClick={() => setShowTrail(!showTrail)} title="Trail">
          <RouteIcon className="h-3 w-3" />
          <span className="hidden sm:inline">Trail</span>
        </Pill>
        <Pill
          active={showPredicted}
          onClick={() => setShowPredicted(!showPredicted)}
          title="Predicted path"
        >
          <Spline className="h-3 w-3" />
          <span className="hidden sm:inline">Predict</span>
        </Pill>
        <Pill active={showLabels} onClick={() => setShowLabels(!showLabels)} title="Labels">
          <Tag className="h-3 w-3" />
          <span className="hidden sm:inline">Labels</span>
        </Pill>
      </div>
    </div>
  );
};
