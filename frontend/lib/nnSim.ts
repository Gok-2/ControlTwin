// Neural Network Based Adaptive Control for 2-DOF Robot Manipulator
//
// Architecture: 8 → 10 → 2   (tanh hidden, linear output)
// Input  x = [q₁, q₂, q̇₁, q̇₂, qd₁, qd₂, q̇d₁, q̇d₂]  (normalised)
// Output τ̂_NN ≈ inverse dynamics
//
// Control law:  τ = τ̂_NN(x;W) + Kv·s      s = ė + λ·e
//
// Online weight update (gradient on sliding loss  J = ½‖s‖²):
//   ΔW₂ = η·s·hᵀ
//   ΔW₁ = η·(W₂ᵀ·s ⊙ (1−h²))·xᵀ   (chain rule through tanh)
//
// True robot dynamics used for state propagation (true p1…p5).

type Vec2 = [number, number]
type Mat2 = [[number, number], [number, number]]

export interface NNParams {
  // True robot parameters
  p1: number; p2: number; p3: number; p4: number; p5: number
  // Controller
  lambda: number    // sliding surface gain
  Kv: number        // feedback (PD) gain
  eta: number       // NN learning rate
  hiddenSize: number
  // Simulation
  tEnd: number; dt: number
  q0: Vec2; dq0: Vec2
}

export interface NNResult {
  t:    number[]
  q1:   number[]; q2:   number[]
  qd1:  number[]; qd2:  number[]
  e1:   number[]; e2:   number[]
  tau1: number[]; tau2: number[]
  tauNN1: number[]; tauNN2: number[]
  wNorm: number[]   // Frobenius norm of W₁
  s1: number[]; s2: number[]
}

export const DEFAULT_NN: NNParams = {
  p1: 3.473, p2: 0.193, p3: 0.242, p4: 5.3, p5: 1.1,
  lambda: 4.0, Kv: 8.0, eta: 0.004,
  hiddenSize: 10,
  tEnd: 20.0, dt: 0.01,
  q0: [0, 0], dq0: [0, 0],
}

// ── Linear algebra ────────────────────────────────────────────────────────────

function mv2(M: Mat2, v: Vec2): Vec2 {
  return [M[0][0]*v[0]+M[0][1]*v[1], M[1][0]*v[0]+M[1][1]*v[1]]
}

function solve2(M: Mat2, b: Vec2): Vec2 {
  const det = M[0][0]*M[1][1] - M[0][1]*M[1][0]
  return [(M[1][1]*b[0]-M[0][1]*b[1])/det, (M[0][0]*b[1]-M[1][0]*b[0])/det]
}

function desired(t: number) {
  return {
    qd:  [ Math.sin(t),  Math.sin(t)] as Vec2,
    dqd: [ Math.cos(t),  Math.cos(t)] as Vec2,
    ddqd:[-Math.sin(t), -Math.sin(t)] as Vec2,
  }
}

function M_mat(q: Vec2, p: number[]): Mat2 {
  const c2 = Math.cos(q[1])
  return [
    [p[0]+p[1]+2*p[2]*c2, p[1]+p[2]*c2],
    [p[1]+p[2]*c2, p[1]],
  ]
}

function Vm_mat(q: Vec2, dq: Vec2, p: number[]): Mat2 {
  const h = -p[2]*Math.sin(q[1])
  return [[h*dq[1], h*(dq[0]+dq[1])], [-h*dq[0], 0]]
}

function clip(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── NN forward pass ───────────────────────────────────────────────────────────

interface Weights {
  W1: number[][]  // hiddenSize × 8
  b1: number[]    // hiddenSize
  W2: number[][]  // 2 × hiddenSize
  b2: number[]    // 2
}

function initWeights(hiddenSize: number, seed = 42): Weights {
  let rng = seed
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    return ((rng >>> 0) / 0xffffffff - 0.5) * 0.2
  }
  return {
    W1: Array.from({ length: hiddenSize }, () => Array.from({ length: 8 }, rand)),
    b1: Array.from({ length: hiddenSize }, () => 0),
    W2: Array.from({ length: 2 }, () => Array.from({ length: hiddenSize }, rand)),
    b2: [0, 0],
  }
}

function normalize(q: Vec2, dq: Vec2, qd: Vec2, dqd: Vec2): number[] {
  return [q[0], q[1], dq[0]/5, dq[1]/5, qd[0], qd[1], dqd[0]/5, dqd[1]/5]
}

function forward(W: Weights, x: number[]): { h: number[]; tau: Vec2 } {
  const h = W.W1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w*x[j], 0) + W.b1[i]))
  const tau: Vec2 = [
    W.W2[0].reduce((s, w, j) => s + w*h[j], 0) + W.b2[0],
    W.W2[1].reduce((s, w, j) => s + w*h[j], 0) + W.b2[1],
  ]
  return { h, tau }
}

function updateWeights(W: Weights, x: number[], h: number[], s: Vec2, eta: number) {
  const H = h.length

  // ΔW₂ = η·s·hᵀ  (2×H)
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < H; j++)
      W.W2[i][j] = clip(W.W2[i][j] + eta*s[i]*h[j], -10, 10)

  W.b2[0] = clip(W.b2[0] + eta*s[0], -10, 10)
  W.b2[1] = clip(W.b2[1] + eta*s[1], -10, 10)

  // δh = W₂ᵀ·s ⊙ (1−h²)  (H×1)
  const delta = h.map((hi, j) =>
    clip((W.W2[0][j]*s[0] + W.W2[1][j]*s[1]) * (1 - hi*hi), -5, 5)
  )

  // ΔW₁ = η·δ·xᵀ  (H×8)
  for (let i = 0; i < H; i++)
    for (let j = 0; j < x.length; j++)
      W.W1[i][j] = clip(W.W1[i][j] + eta*delta[i]*x[j], -10, 10)

  for (let i = 0; i < H; i++)
    W.b1[i] = clip(W.b1[i] + eta*delta[i], -10, 10)
}

function frobNorm(W: number[][]): number {
  return Math.sqrt(W.flat().reduce((s, v) => s + v*v, 0))
}

// ── Simulation ────────────────────────────────────────────────────────────────

export function runNNSimulation(p: NNParams): NNResult {
  const { dt, tEnd, lambda, Kv, eta, hiddenSize, q0, dq0 } = p
  const pTrue = [p.p1, p.p2, p.p3, p.p4, p.p5]
  const N = Math.floor(tEnd / dt)

  const W = initWeights(hiddenSize)

  const out: NNResult = {
    t: [], q1: [], q2: [], qd1: [], qd2: [],
    e1: [], e2: [], tau1: [], tau2: [],
    tauNN1: [], tauNN2: [], wNorm: [],
    s1: [], s2: [],
  }

  let q: Vec2  = [...q0]
  let dq: Vec2 = [...dq0]

  for (let i = 0; i < N; i++) {
    const t = i * dt
    const { qd, dqd, ddqd } = desired(t)

    const e:  Vec2 = [qd[0]-q[0], qd[1]-q[1]]
    const de: Vec2 = [dqd[0]-dq[0], dqd[1]-dq[1]]
    const s:  Vec2 = [de[0]+lambda*e[0], de[1]+lambda*e[1]]

    const x = normalize(q, dq, qd, dqd)
    const { h, tau: tauNN } = forward(W, x)

    const tau: Vec2 = [tauNN[0] + Kv*s[0], tauNN[1] + Kv*s[1]]

    // True robot dynamics
    const Mq  = M_mat(q, pTrue)
    const Vmq = Vm_mat(q, dq, pTrue)
    const Fd: Vec2 = [pTrue[3]*dq[0], pTrue[4]*dq[1]]
    const rhs: Vec2 = [
      tau[0] - mv2(Vmq, dq)[0] - Fd[0],
      tau[1] - mv2(Vmq, dq)[1] - Fd[1],
    ]
    const ddq = solve2(Mq, rhs)

    // Record
    out.t.push(parseFloat(t.toFixed(5)))
    out.q1.push(q[0]); out.q2.push(q[1])
    out.qd1.push(qd[0]); out.qd2.push(qd[1])
    out.e1.push(e[0]); out.e2.push(e[1])
    out.tau1.push(tau[0]); out.tau2.push(tau[1])
    out.tauNN1.push(tauNN[0]); out.tauNN2.push(tauNN[1])
    out.wNorm.push(frobNorm(W.W1))
    out.s1.push(s[0]); out.s2.push(s[1])

    // Update weights
    updateWeights(W, x, h, s, eta)

    // RK4 state update (simplified: Euler for speed, good enough for demo)
    q  = [q[0]  + dt*dq[0],  q[1]  + dt*dq[1]]
    dq = [dq[0] + dt*ddq[0], dq[1] + dt*ddq[1]]
  }

  return out
}
