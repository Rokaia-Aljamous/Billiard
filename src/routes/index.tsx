import { createFileRoute } from "@tanstack/react-router";
import { Scene3D } from "@/components/sim/Scene3D";
import { SceneToolbar } from "@/components/sim/SceneToolbar";
import { MathPanel } from "@/components/sim/MathPanel";
import { Controls } from "@/components/sim/Controls";
import { Charts } from "@/components/sim/Charts";
import { ModuleTabs } from "@/components/sim/ModuleTabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Billiard Physics Engine Simulator" },
      {
        name: "description",
        content:
          "Scientific 3D simulator for billiard ball mechanics: forces, momentum, spin, collisions, and energy.",
      },
      { property: "og:title", content: "Billiard Physics Engine Simulator" },
      {
        property: "og:description",
        content:
          "Visualize Newtonian mechanics, rotational dynamics, collisions, and projectile motion in real time.",
      },
    ],
  }),
  component: Lab,
});

function Lab() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/30 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Billiard Physics Engine Simulator
            </h1>
            <p className="text-xs text-muted-foreground">
              Real-time Newtonian & rotational mechanics laboratory.
            </p>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            F = ma · τ = r×F · L = Iω · Eₖ = ½mv² · Eᵣ = ½Iω²
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="order-2 xl:order-1">
          <Controls />
        </aside>

        <section className="order-1 space-y-4 xl:order-2">
          <ModuleTabs />
          <div className="relative h-[62vh] min-h-[480px] overflow-hidden rounded-lg border border-border/50 bg-[#070a10] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
            <Scene3D />
            <SceneToolbar />
          </div>
          <Charts />
        </section>

        <aside className="order-3">
          <MathPanel />
        </aside>
      </main>
    </div>
  );
}
