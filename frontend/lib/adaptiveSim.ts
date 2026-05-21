// Adaptive Control for 2-DOF Robot Manipulator
//
// Controller: τ = Y(q, q̇, q̇ᵣ, q̈ᵣ)·θ̂  −  Kₛ·s
// Adaptation: θ̂˙ = Γ · Yᵀ · s
// Sliding var: s = ė + λ·e     (e = qd − q)
//
// Regressor Y (5 columns = [p1, p2, p3, p4, p5]):
//   Y = [[q̈ᵣ₁,  q̈ᵣ₁+q̈ᵣ₂,  2c₂q̈ᵣ₁+c₂q̈ᵣ₂ − s₂dq₂q̇ᵣ₁ − s₂(dq₁+dq₂)q̇ᵣ₂,  dq₁,  0  ],
//         [0,    q̈ᵣ₁+q̈ᵣ₂,  c₂q̈ᵣ₁ + s₂dq₁q̇ᵣ₁,                             0,    dq₂]]
//
// True robot: M(q)·q̈ + Vm(q,q̇)·q̇ + Fd·q̇ = τ  (solved with true p1…p5)
// Proven stable via Lyapunov V = ½sᵀMs + ½θ̃ᵀΓ⁻¹θ̃ → V̇ ≤ 0

type Vec2 = [number, number]
type Mat2 = [[number, number], [number, number]]
type Vec5 = [number, number, number, number, number]

export interface AdaptiveParams {
  // True robot parameters
  p1: number; p2: number; p3: number; p4: number; p5: number
  // Initial parameter estimates (controller starts here)
  p1_init: number; p2_init: number; p3_init: number; p4_init: number; p5_init: number
  // Controller
  lambda: number   // sliding surface: s = ė + λ·e
  Ks: number       // robust feedback gain
  gamma: number    // adaptation gain Γ = γ·I₅
  // Simulation
  tEnd: number; dt: number
  q0: Vec2; dq0: Vec2
}

export interface AdaptiveResult {
  t:    number[]
  q1:   number[]; q2:   number[]
  qd1:  number[]; qd2:  number[]
  e1:   number[]; e2:   number[]
  tau1: number[]; tau2: number[]
  // Parameter estimate trajectories
  p1h: number[]; p2h: number[]
  p3h: number[]; p4h: number[]
  p5h: number[]
  // Sliding variable
  s1: number[]; s2: number[]
}

export const DEFAULT_ADAPTIVE: AdaptiveParams = {
  p1: 3.473, p2: 0.193, p3: 0.242, p4: 5.3, p5: 1.1,
  p1_init: 1.5, p2_init: 0.08, p3_init: 0.1, p4_init: 2.0, p5_init: 0.5,
  lambda: 5.0, Ks: 2.0, gamma: 3.0,
  tEnd: 15.0, dt: 0.01,
  q0: [0, 0], dq0: [0, 0],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mv(M: Mat2, v: Vec2): Vec2 {
  return [M[0][0]*v[0] + M[0][1]*v[1], M[1][0]*v[0] + M[1][1]*v[1]]
}

function solve2(M: Mat2, b: Vec2): Vec2 {
  const det = M[0][0]*M[1][1] - M[0][1]*M[1][0]
  return [(M[1][1]*b[0] - M[0][1]*b[1]) / det,
          (M[0][0]*b[1] - M[1][0]*b[0]) / det]
}

function desired(t: number) {
  return {
    qd:   [ Math.sin(t),  Math.sin(t)] as Vec2,
    dqd:  [ Math.cos(t),  Math.cos(t)] as Vec2,
    ddqd: [-Math.sin(t), -Math.sin(t)] as Vec2,
  }
}

// Inertia matrix using parameter vector
function M_mat(q: Vec2, p: Vec5): Mat2 {
  const c2 = Math.cos(q[1])
  return [
    [p[0] + p[1] + 2*p[2]*c2, p[1] + p[2]*c2],
    [p[1] + p[2]*c2,           p[1]],
  ]
}

// Coriolis matrix
function Vm_mat(q: Vec2, dq: Vec2, p: Vec5): Mat2 {
  const h = -p[2] * Math.sin(q[1])
  return [
    [h*dq[1],  h*(dq[0]+dq[1])],
    [-h*dq[0], 0],
  ]
}

// Friction vector
function Fd_dq(dq: Vec2, p: Vec5): Vec2 {
  return [p[3]*dq[0], p[4]*dq[1]]
}

// Regressor matrix Y (2×5) → returns [Y[0], Y[1]] as Vec5 each
function regressor(
  q: Vec2, dq: Vec2,
  qr_dot: Vec2,   // q̇ᵣ = q̇d + λ·e
  qr_ddot: Vec2,  // q̈ᵣ = q̈d + λ·ė
): [Vec5, Vec5] {
  const c2 = Math.cos(q[1]), s2 = Math.sin(q[1])
  const [vr1, vr2]   = qr_dot
  const [ar1, ar2]   = qr_ddot
  const [dq1, dq2]   = dq

  const Y1: Vec5 = [
    ar1,
    ar1 + ar2,
    2*c2*ar1 + c2*ar2 - s2*dq2*vr1 - s2*(dq1+dq2)*vr2,
    dq1,
    0,
  ]
  const Y2: Vec5 = [
    0,
    ar1 + ar2,
    c2*ar1 + s2*dq1*vr1,
    0,
    dq2,
  ]
  return [Y1, Y2]
}

// ── Simulation ────────────────────────────────────────────────────────────────

export function runAdaptiveSimulation(p: AdaptiveParams): AdaptiveResult {
  const { dt, tEnd, lambda, Ks, gamma, q0, dq0 } = p
  const pTrue: Vec5 = [p.p1, p.p2, p.p3, p.p4, p.p5]

  const N = Math.floor(tEnd / dt)

  const out: AdaptiveResult = {
    t: [], q1: [], q2: [], qd1: [], qd2: [],
    e1: [], e2: [], tau1: [], tau2: [],
    p1h: [], p2h: [], p3h: [], p4h: [], p5h: [],
    s1: [], s2: [],
  }

  // State: [q1, q2, dq1, dq2, p̂1…p̂5]
  let q: Vec2  = [...q0]
  let dq: Vec2 = [...dq0]
  let ph: Vec5 = [p.p1_init, p.p2_init, p.p3_init, p.p4_init, p.p5_init]

  for (let i = 0; i < N; i++) {
    const t = i * dt
    const { qd, dqd, ddqd } = desired(t)

    const e:  Vec2 = [qd[0]-q[0],   qd[1]-q[1]]
    const de: Vec2 = [dqd[0]-dq[0], dqd[1]-dq[1]]
    const s:  Vec2 = [de[0] + lambda*e[0], de[1] + lambda*e[1]]

    // Reference signals
    const qr_dot:  Vec2 = [dqd[0] + lambda*e[0], dqd[1] + lambda*e[1]]
    const qr_ddot: Vec2 = [ddqd[0] + lambda*de[0], ddqd[1] + lambda*de[1]]

    const [Y1, Y2] = regressor(q, dq, qr_dot, qr_ddot)

    // Control torque using estimated parameters
    const tau: Vec2 = [
      Y1.reduce((acc, y, k) => acc + y*ph[k], 0) - Ks*s[0],
      Y2.reduce((acc, y, k) => acc + y*ph[k], 0) - Ks*s[1],
    ]

    // True robot dynamics
    const Mq  = M_mat(q, pTrue)
    const Vmq = Vm_mat(q, dq, pTrue)
    const Fd  = Fd_dq(dq, pTrue)
    const rhs: Vec2 = [
      tau[0] - mv(Vmq, dq)[0] - Fd[0],
      tau[1] - mv(Vmq, dq)[1] - Fd[1],
    ]
    const ddq = solve2(Mq, rhs)

    // Record
    out.t.push(parseFloat(t.toFixed(5)))
    out.q1.push(q[0]); out.q2.push(q[1])
    out.qd1.push(qd[0]); out.qd2.push(qd[1])
    out.e1.push(e[0]); out.e2.push(e[1])
    out.tau1.push(tau[0]); out.tau2.push(tau[1])
    out.p1h.push(ph[0]); out.p2h.push(ph[1])
    out.p3h.push(ph[2]); out.p4h.push(ph[3])
    out.p5h.push(ph[4])
    out.s1.push(s[0]); out.s2.push(s[1])

    // RK4 for robot state
    const ode = (qq: Vec2, dqq: Vec2): [Vec2, Vec2] => {
      const { qd: qd_, dqd: dqd_, ddqd: ddqd_ } = desired(t)
      const e_: Vec2  = [qd_[0]-qq[0], qd_[1]-qq[1]]
      const de_: Vec2 = [dqd_[0]-dqq[0], dqd_[1]-dqq[1]]
      const s_: Vec2  = [de_[0]+lambda*e_[0], de_[1]+lambda*e_[1]]
      const qrd: Vec2  = [dqd_[0]+lambda*e_[0], dqd_[1]+lambda*e_[1]]
      const qrdd: Vec2 = [ddqd_[0]+lambda*de_[0], ddqd_[1]+lambda*de_[1]]
      const [Y1_, Y2_] = regressor(qq, dqq, qrd, qrdd)
      const tau_: Vec2 = [
        Y1_.reduce((a, y, k) => a + y*ph[k], 0) - Ks*s_[0],
        Y2_.reduce((a, y, k) => a + y*ph[k], 0) - Ks*s_[1],
      ]
      const M_ = M_mat(qq, pTrue)
      const Vm_ = Vm_mat(qq, dqq, pTrue)
      const Fd_ = Fd_dq(dqq, pTrue)
      const rhs_: Vec2 = [tau_[0] - mv(Vm_, dqq)[0] - Fd_[0], tau_[1] - mv(Vm_, dqq)[1] - Fd_[1]]
      return [dqq, solve2(M_, rhs_)]
    }

    const [dq1k1, ddq1k1] = ode(q, dq)
    const [dq1k2, ddq1k2] = ode(
      [q[0]+dt/2*dq1k1[0], q[1]+dt/2*dq1k1[1]],
      [dq[0]+dt/2*ddq1k1[0], dq[1]+dt/2*ddq1k1[1]],
    )
    const [dq1k3, ddq1k3] = ode(
      [q[0]+dt/2*dq1k2[0], q[1]+dt/2*dq1k2[1]],
      [dq[0]+dt/2*ddq1k2[0], dq[1]+dt/2*ddq1k2[1]],
    )
    const [dq1k4, ddq1k4] = ode(
      [q[0]+dt*dq1k3[0], q[1]+dt*dq1k3[1]],
      [dq[0]+dt*ddq1k3[0], dq[1]+dt*ddq1k3[1]],
    )

    q  = [q[0]  + dt/6*(dq1k1[0]  + 2*dq1k2[0]  + 2*dq1k3[0]  + dq1k4[0]),
          q[1]  + dt/6*(dq1k1[1]  + 2*dq1k2[1]  + 2*dq1k3[1]  + dq1k4[1])]
    dq = [dq[0] + dt/6*(ddq1k1[0] + 2*ddq1k2[0] + 2*ddq1k3[0] + ddq1k4[0]),
          dq[1] + dt/6*(ddq1k1[1] + 2*ddq1k2[1] + 2*ddq1k3[1] + ddq1k4[1])]

    // Adaptation law: θ̂˙ = Γ·Yᵀ·s  (Γ = γ·I)
    for (let k = 0; k < 5; k++) {
      ph[k] += dt * gamma * (Y1[k]*s[0] + Y2[k]*s[1])
      ph[k] = Math.max(-50, Math.min(50, ph[k])) // bound estimates
    }
  }

  return out
}
