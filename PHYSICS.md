# Physics Engine Documentation

This document describes the physics architecture of the Billiard Physics Engine
Simulator. The engine is intentionally self-contained and is **not modified** by
the visualization or UI layers.

## File Map

| Layer | File | Responsibility |
| --- | --- | --- |
| Pure math + types | `src/physics/types.ts` | `Vec3`, `Ball`, vector ops (`vadd`, `vsub`, `vscale`, `vdot`, `vcross`, `vlen`, `vnorm`), and per-ball quantities (`momentOfInertia`, `kineticEnergy`, `rotationalEnergy`, `momentum`, `angularMomentum`). |
| Dynamics engine | `src/physics/engine.ts` | `World`, `stepBall` (single-body integration with gravity / normal / friction / rolling / cushions), `resolveCollision` (ball–ball elastic impulse), `applyCue` (impulse + spin from cue impact). |
| Simulation orchestration | `src/store/simStore.ts` | Holds all balls and `World`, runs sub-stepped updates via `step(dt)`, calls `stepBall` and `resolveCollision`, records collision events, builds the predicted trajectory. **No physics math lives here** — it only calls the engine. |
| Rendering | `src/components/sim/Scene3D.tsx` | Reads ball state and forces and renders them; visual-only. |
| UI | `src/components/sim/Controls.tsx`, `SceneToolbar.tsx`, `MathPanel.tsx`, `Charts.tsx` | Tunes world / ball parameters and reads diagnostics. |

---

## Concept-by-concept reference

### 1. Gravity
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall`
- **Variables:** `w.gravity` (m/s²), `b.mass`
- **Equation:** `F_g = (0, −m·g, 0)`
- **Effect:** Acts on every ball every frame. When the ball is on the cloth
  (`b.airborne === false`) it is cancelled by the normal force. When airborne,
  it becomes the ball's acceleration: `a = F_g / m`.

### 2. Normal Force
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall`
- **Variables:** `b.mass`, `w.gravity`
- **Equation:** `N = (0, +m·g, 0)` while `b.airborne === false`
- **Effect:** Cancels gravity on the cloth. Its magnitude `N = m·g` is what
  feeds the Coulomb friction model below.

### 3. Sliding (Kinetic) Friction
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall` (the `slip > 0.02` branch)
- **Variables:** `w.muKinetic`, `b.mass`, `w.gravity`, `b.vel`, `b.omega`, `b.radius`
- **Slip computation:**
  - Contact point offset: `r_C = (0, −R, 0)`
  - Contact-point velocity: `v_C = v + ω × r_C`
  - Horizontal slip vector: `v_Ch = (v_C.x, 0, v_C.z)`, magnitude `|v_Ch|`
- **Equation:** `F_f = −μ_k · m · g · v̂_Ch`
- **Effect:** Decelerates the slipping ball and, together with the torque
  below, drives ω toward the no-slip rolling condition.

### 4. Torque from Friction (sliding case)
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall`
- **Variables:** `r_C`, `F_f`
- **Equation:** `τ = r_C × F_f`
- **Effect:** Integrated into angular velocity below; this is what converts a
  pure-slide shot into a rolling ball.

### 5. Rolling Resistance
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall` (the rolling branch, `slip ≤ 0.02`)
- **Variables:** `w.muRolling`, `b.mass`, `w.gravity`, `b.vel`
- **Equation:** `F_rr = −μ_r · m · g · v̂`
- **Effect:** Slowly bleeds linear speed once the ball rolls without slipping.
  In the same branch, ω is locked to the rolling-without-slip condition
  `ω = (n̂ × v) / R` (n̂ = world-up) so the visual spin always matches the
  translation.

### 6. Cue Impact Force (impulse + spin)
- **File:** `src/physics/engine.ts`
- **Function:** `applyCue(ball, forceN, angleDeg, offsetRight, offsetUp, durationS = 0.005)`
- **Variables:** `forceN`, `durationS`, aim direction `dir`, contact offsets
  `offsetRight`, `offsetUp`, `momentOfInertia(ball)`
- **Equations:**
  - Linear impulse: `J = F · Δt · dir`, so `Δv = J / m`
  - Angular impulse from off-center hit: `r = right·offsetRight + up·offsetUp`,
    `ΔL = r × J`, `Δω = (r × J) / I`
  - Jump-shot approximation when struck below center (`offsetUp < −0.005`):
    adds a small vertical velocity and flips `airborne = true`.
- **Effect:** The single entry point used by the store to launch the cue ball.
  All cue mechanics — top/back/side spin, masse, draw — emerge from the
  off-center torque term.

### 7. Linear Momentum
- **File:** `src/physics/types.ts`
- **Function:** `momentum(b)`
- **Equation:** `p = m · v`
- **Effect:** Read by `MathPanel` / `Charts` and used to draw the momentum
  vector arrow in `Scene3D`.

### 8. Angular Momentum
- **File:** `src/physics/types.ts`
- **Function:** `angularMomentum(b)`
- **Equation:** `L = I · ω`, with `I = (2/5) m R²`
- **Effect:** Diagnostic display.

### 9. Angular Velocity & Angular Acceleration
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall`
- **Variables:** `b.omega`, `τ`, `I`
- **Equations:**
  - Angular acceleration: `α = τ / I`
  - Symplectic Euler integration: `ω_{t+1} = ω_t + α · dt`
  - In the rolling branch the horizontal components of ω are *set* directly
    to the no-slip target `(n̂ × v) / R` (the vertical/spin axis is preserved).
- **Effect:** Drives the visual spin of every ball and the post-collision
  behaviour for spinning shots.

### 10. Kinetic Energy
- **File:** `src/physics/types.ts`
- **Function:** `kineticEnergy(b)`
- **Equation:** `E_k = ½ m v·v`
- **Effect:** Plotted in the energy chart and shown in the math panel.

### 11. Rotational Energy
- **File:** `src/physics/types.ts`
- **Function:** `rotationalEnergy(b)`
- **Equation:** `E_r = ½ I ω·ω`
- **Effect:** Same as above; together with `E_k` lets the UI verify energy
  bookkeeping.

### 12. Total Energy
- **File:** `src/store/simStore.ts` (composition only)
- **Function:** sample-collection inside `step` (sums per ball)
- **Equation:** `E_total = Σ (E_k + E_r)`
- **Effect:** Should decay monotonically while friction is on and stay flat
  between collisions when friction is disabled — a useful sanity check.

### 13. Ball-to-Ball Collisions
- **File:** `src/physics/engine.ts`
- **Function:** `resolveCollision(a, b, e)`
- **Variables:** `a.pos`, `b.pos`, radii, masses, restitution `e`
- **Equations:**
  - Overlap: `δ = (R_a + R_b) − |b.pos − a.pos|`; positional correction splits
    `δ` equally along the normal `n̂`.
  - Normal-axis relative velocity: `v_n = (v_b − v_a) · n̂`
  - Impulse magnitude: `j = −(1 + e) · v_n / (1/m_a + 1/m_b)`
  - Velocity update: `v_a -= (j/m_a)·n̂`, `v_b += (j/m_b)·n̂`
- **Effect:** Standard equal-mass impulse-based elastic resolution; for equal
  masses it produces the classic 90° separation when one ball is at rest.

### 14. Cushion Collisions
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall` (the `cushionsEnabled` block)
- **Variables:** `w.tableHalfWidth`, `w.tableHalfLength`, `b.radius`,
  `w.cushionRestitution`
- **Equations (per axis):** if the ball penetrates the rail, clamp position and
  reflect the normal-axis velocity component with damping:
  `v_n ← −e_c · v_n`.
- **Effect:** Models rail bounces. `cushionRestitution` is set to
  `restitution · 0.9` by the store so cushion bounces feel slightly damper
  than ball-on-ball.

### 15. Restitution Coefficient
- **File:** `src/physics/engine.ts`
- **Used in:** `resolveCollision` (parameter `e`) and `stepBall` (parameter
  `w.cushionRestitution`).
- **Configured in:** `src/store/simStore.ts` → `setControl`, which keeps
  `world.restitution = controls.restitution` and
  `world.cushionRestitution = controls.restitution * 0.9`.
- **Effect:** Controls how "lively" collisions feel; `e = 1` is perfectly
  elastic, `e = 0` is perfectly plastic.

### 16. Position Integration
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall`
- **Equation:** `p_{t+1} = p_t + v_{t+1} · dt` (symplectic Euler — velocity is
  updated first, then position).
- **Effect:** Stable for the small `dt` used (≤ 1/60 s, further sub-stepped
  ×4 in `Ticker`).

### 17. Velocity Integration
- **File:** `src/physics/engine.ts`
- **Function:** `stepBall`
- **Equation:** `v_{t+1} = v_t + a · dt`, where `a = F_net / m`
- **Effect:** Drives both the airborne (only gravity) and on-cloth (friction
  or rolling resistance) regimes.

---

## Documentation Table

| Physics Concept | File | Function | Variables | Description |
| --- | --- | --- | --- | --- |
| Gravity | `physics/engine.ts` | `stepBall` | `w.gravity`, `b.mass` | `F_g = (0, −m·g, 0)`; only affects motion when airborne. |
| Normal Force | `physics/engine.ts` | `stepBall` | `b.mass`, `w.gravity` | `N = m·g` upward while on cloth; cancels gravity, feeds friction. |
| Sliding Friction | `physics/engine.ts` | `stepBall` (slip branch) | `w.muKinetic`, `m`, `g`, `v + ω × r_C` | `F_f = −μ_k m g · v̂_Ch`; opposes contact-point slip. |
| Rolling Resistance | `physics/engine.ts` | `stepBall` (roll branch) | `w.muRolling`, `m`, `g`, `b.vel` | `F_rr = −μ_r m g · v̂`; small drag after the ball begins rolling. |
| Cue Impact | `physics/engine.ts` | `applyCue` | `forceN`, `durationS`, `dir`, `offsetRight`, `offsetUp`, `I` | `J = F·Δt·dir`, `Δv = J/m`; off-center hit adds `Δω = (r × J)/I`. |
| Linear Momentum | `physics/types.ts` | `momentum` | `m`, `v` | `p = m·v`. |
| Angular Momentum | `physics/types.ts` | `angularMomentum` | `I`, `ω` | `L = I·ω`, with `I = (2/5) m R²`. |
| Torque | `physics/engine.ts` | `stepBall` | `r_C`, `F_f` | `τ = r_C × F_f` from contact friction. |
| Angular Velocity | `physics/engine.ts` | `stepBall` | `ω`, `α`, `dt` | Slide: `ω ← ω + α·dt`; Roll: `ω_horiz = (n̂ × v)/R`. |
| Angular Acceleration | `physics/engine.ts` | `stepBall` | `τ`, `I` | `α = τ / I`. |
| Kinetic Energy | `physics/types.ts` | `kineticEnergy` | `m`, `v` | `E_k = ½ m v·v`. |
| Rotational Energy | `physics/types.ts` | `rotationalEnergy` | `I`, `ω` | `E_r = ½ I ω·ω`. |
| Total Energy | `store/simStore.ts` | `step` (sampling) | per-ball `E_k`, `E_r` | `E_total = Σ (E_k + E_r)`. |
| Ball–Ball Collisions | `physics/engine.ts` | `resolveCollision` | `pos`, `vel`, `m`, `R`, `e` | Positional correction + impulse `j = −(1+e)·v_n / (1/m_a + 1/m_b)`. |
| Cushion Collisions | `physics/engine.ts` | `stepBall` (cushion block) | `tableHalfWidth/Length`, `R`, `cushionRestitution` | Clamp position, reflect normal-axis velocity with damping `e_c`. |
| Restitution Coefficient | `physics/engine.ts` | `resolveCollision`, `stepBall` | `e`, `w.cushionRestitution` | Configurable in UI; cushion is `0.9·e` by convention in the store. |
| Position Integration | `physics/engine.ts` | `stepBall` | `pos`, `vel`, `dt` | Symplectic Euler: `p ← p + v·dt`. |
| Velocity Integration | `physics/engine.ts` | `stepBall` | `vel`, `acc`, `dt` | `v ← v + a·dt`, `a = F_net/m`. |

---

## Notes on what is **not** in the physics engine

- The cue stick visuals, aim angle, elevation angle, pull-back animation, and
  predicted-path overlay live entirely in `src/components/sim/Scene3D.tsx`
  and `src/store/simStore.ts`. None of them change the integrator, collision
  solver, or `applyCue`.
- The store's `step(dt)` is the single place that drives the engine each
  frame; it calls `stepBall` for every ball and then `resolveCollision` for
  every unique pair. Sub-stepping (×4 per render frame) is handled by the
  `Ticker` component in `Scene3D.tsx` and only affects numerical stability,
  not the physical equations themselves.
