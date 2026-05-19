// 2-DOF Non-linear Robot Manipulator Simulation
// Equations of motion:  M(q)·q̈ + Vm(q,q̇)·q̇ + Fd·q̇ = τ
// Controller (Computed Torque):  τ = M(q)·v + Vm(q,q̇)·q̇ + Fd·q̇
//   where v = q̈_d + Kr·(q̇_d − q̇) + α·(q_d − q)
// Desired trajectory:  q_d(t) = [sin t, sin t]
// Closed-loop error dynamics:  ë + Kr·ė + α·e = 0
// Integrated with 4th-order Runge-Kutta (RK4).

export interface SimParams {
  p1: number    // kg·m²   joint 1 composite inertia
  p2: number    // kg·m²   joint 2 inertia
  p3: number    // kg·m²   coupling inertia
  p4: number    // N·m·s   viscous friction joint 1
  p5: number    // N·m·s   viscous friction joint 2
  Kr: number    //         derivative gain
  alpha: number //         proportional gain
  tEnd: number  // s       simulation duration
  dt: number    // s       integration timestep
  q0: [number, number]   // rad  initial joint angles
  dq0: [number, number]  // rad/s initial joint velocities
}

export const DEFAULT_PARAMS: SimParams = {
  p1: 3.473, p2: 0.193, p3: 0.242, p4: 5.3, p5: 1.1,
  Kr: 10.0, alpha: 5.0,
  tEnd: 10.0, dt: 0.01,
  q0: [0.0, 0.0], dq0: [0.0, 0.0],
}

export interface SimResult {
  t:    number[]
  q1:   number[];  q2:   number[]
  qd1:  number[];  qd2:  number[]
  e1:   number[];  e2:   number[]
  tau1: number[];  tau2: number[]
}

// ── Linear algebra helpers ────────────────────────────────────────────────────

type Vec2 = [number, number]
type Mat2 = [[number, number], [number, number]]

function mv(M: Mat2, v: Vec2): Vec2 {
  return [M[0][0]*v[0] + M[0][1]*v[1], M[1][0]*v[0] + M[1][1]*v[1]]
}

// Solve 2×2 system M·x = b  (Cramer's rule)
function solve(M: Mat2, b: Vec2): Vec2 {
  const det = M[0][0]*M[1][1] - M[0][1]*M[1][0]
  return [(M[1][1]*b[0] - M[0][1]*b[1]) / det,
          (M[0][0]*b[1] - M[1][0]*b[0]) / det]
}

// ── Robot model ───────────────────────────────────────────────────────────────

function desired(t: number) {
  return {
    qd:   [ Math.sin(t),  Math.sin(t)] as Vec2,
    dqd:  [ Math.cos(t),  Math.cos(t)] as Vec2,
    ddqd: [-Math.sin(t), -Math.sin(t)] as Vec2,
  }
}

function dynamics(p: SimParams, t: number, q: Vec2, dq: Vec2) {
  const { p1, p2, p3, p4, p5, Kr, alpha } = p
  const c2 = Math.cos(q[1])
  const h  = -p3 * Math.sin(q[1])

  const M: Mat2 = [
    [p1 + p2 + 2*p3*c2, p2 + p3*c2],
    [p2 + p3*c2,         p2],
  ]
  const Vm: Mat2 = [
    [h*dq[1],  h*(dq[0]+dq[1])],
    [-h*dq[0], 0],
  ]
  const Fddq: Vec2 = [p4*dq[0], p5*dq[1]]

  const { qd, dqd, ddqd } = desired(t)
  const e:  Vec2 = [qd[0]-q[0],   qd[1]-q[1]]
  const de: Vec2 = [dqd[0]-dq[0], dqd[1]-dq[1]]
  const v:  Vec2 = [ddqd[0] + Kr*de[0] + alpha*e[0],
                    ddqd[1] + Kr*de[1] + alpha*e[1]]

  const Vmdq = mv(Vm, dq)
  const tau: Vec2 = [mv(M, v)[0] + Vmdq[0] + Fddq[0],
                     mv(M, v)[1] + Vmdq[1] + Fddq[1]]

  // M·q̈ = τ − Vm·q̇ − Fd·q̇
  const rhs: Vec2 = [tau[0] - Vmdq[0] - Fddq[0],
                     tau[1] - Vmdq[1] - Fddq[1]]
  const ddq = solve(M, rhs)

  return { tau, e, qd, ddq }
}

function ode(p: SimParams, t: number, s: number[]): number[] {
  const q:  Vec2 = [s[0], s[1]]
  const dq: Vec2 = [s[2], s[3]]
  const { ddq } = dynamics(p, t, q, dq)
  return [dq[0], dq[1], ddq[0], ddq[1]]
}

// ── RK4 integrator ────────────────────────────────────────────────────────────

export function runSimulation(p: SimParams): SimResult {
  const { tEnd, dt, q0, dq0 } = p
  const N = Math.floor(tEnd / dt)

  const t:    number[] = []
  const q1r:  number[] = [], q2r:  number[] = []
  const qd1r: number[] = [], qd2r: number[] = []
  const e1r:  number[] = [], e2r:  number[] = []
  const tau1r:number[] = [], tau2r:number[] = []

  let s = [q0[0], q0[1], dq0[0], dq0[1]]

  for (let i = 0; i < N; i++) {
    const tc = i * dt
    const q:  Vec2 = [s[0], s[1]]
    const dq: Vec2 = [s[2], s[3]]

    const { tau, e, qd } = dynamics(p, tc, q, dq)

    t.push(parseFloat(tc.toFixed(5)))
    q1r.push(q[0]);    q2r.push(q[1])
    qd1r.push(qd[0]);  qd2r.push(qd[1])
    e1r.push(e[0]);    e2r.push(e[1])
    tau1r.push(tau[0]); tau2r.push(tau[1])

    // RK4 step
    const k1 = ode(p, tc,          s)
    const k2 = ode(p, tc + dt/2,   s.map((v, j) => v + dt/2 * k1[j]))
    const k3 = ode(p, tc + dt/2,   s.map((v, j) => v + dt/2 * k2[j]))
    const k4 = ode(p, tc + dt,     s.map((v, j) => v + dt   * k3[j]))
    s = s.map((v, j) => v + (dt/6)*(k1[j] + 2*k2[j] + 2*k3[j] + k4[j]))
  }

  return { t, q1: q1r, q2: q2r, qd1: qd1r, qd2: qd2r, e1: e1r, e2: e2r, tau1: tau1r, tau2: tau2r }
}

// ── Stability analysis (closed-loop: ë + Kr·ė + α·e = 0) ─────────────────────

export interface StabilityInfo {
  wn: number       // natural frequency  √α
  zeta: number     // damping ratio      Kr / (2√α)
  lambda: string   // eigenvalues as formatted string
  stable: boolean
  regime: string   // underdamped / critically / overdamped
}

export function analyzeStability(Kr: number, alpha: number): StabilityInfo {
  if (alpha <= 0) return { wn: 0, zeta: 0, lambda: 'N/A', stable: false, regime: 'unstable' }
  const wn   = Math.sqrt(alpha)
  const zeta = Kr / (2 * wn)
  const disc = Kr*Kr - 4*alpha

  let lambda: string
  if (Math.abs(disc) < 1e-9) {
    lambda = `λ₁₂ = ${(-Kr/2).toFixed(3)} (repeated)`
  } else if (disc > 0) {
    const r = Math.sqrt(disc)
    lambda = `λ₁ = ${((-Kr+r)/2).toFixed(3)},  λ₂ = ${((-Kr-r)/2).toFixed(3)}`
  } else {
    const im = Math.sqrt(-disc) / 2
    lambda = `λ₁₂ = ${(-Kr/2).toFixed(3)} ± ${im.toFixed(3)}j`
  }

  const stable = Kr > 0 && alpha > 0
  const regime = zeta < 1 ? 'underdamped' : zeta === 1 ? 'critically damped' : 'overdamped'

  return { wn, zeta, lambda, stable, regime }
}
