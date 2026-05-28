// Pure-math 3D FK and workspace computation — no Three.js dependency

export interface WorkspaceJoint {
  type: 'R' | 'P'
  length: number
  name?: string
  prismaticDir?: [number, number, number]
  rotationAxis?: 'X' | 'Y' | 'Z'
}

// ── 4×4 row-major matrix math ─────────────────────────────────────────────────

type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

function identity(): Mat4 {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
}

function multiply(A: Mat4, B: Mat4): Mat4 {
  const C = new Array(16) as Mat4
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += A[i*4+k] * B[k*4+j]
      C[i*4+j] = s
    }
  return C
}

function makeRotX(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a)
  return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]
}
function makeRotY(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a)
  return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]
}
function makeRotZ(a: number): Mat4 {
  const c = Math.cos(a), s = Math.sin(a)
  return [c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]
}
function makeTrans(x: number, y: number, z: number): Mat4 {
  return [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1]
}

// Apply T to origin (0,0,0,1) — returns translation column [T[3], T[7], T[11]]
function pos(T: Mat4): [number, number, number] {
  return [T[3], T[7], T[11]]
}

// ── 3D Forward Kinematics ─────────────────────────────────────────────────────
// Replicates RobotCanvas3D's computeFK3D logic with plain row-major math.

export function computeFK3DPure(
  joints: WorkspaceJoint[],
  values: number[],
): [number, number, number][] {
  const points: [number, number, number][] = [[0, 0, 0]]
  let T = identity()

  for (let i = 0; i < joints.length; i++) {
    const { type, length } = joints[i]
    const q = values[i] ?? 0

    if (type === 'R') {
      const axis = joints[i].rotationAxis ?? (i === 0 ? 'Y' : 'Z')
      const rot = axis === 'Y' ? makeRotY(q) : axis === 'X' ? makeRotX(q) : makeRotZ(q)
      T = multiply(T, rot)
      T = multiply(T, makeTrans(length, 0, 0))
    } else {
      const d = Math.max(0, Math.min(length, q))
      const [dx, dy, dz] = joints[i].prismaticDir ?? [1, 0, 0]
      T = multiply(T, makeTrans(dx * d, dy * d, dz * d))
    }
    points.push(pos(T))
  }

  return points
}

// ── 3D workspace / taskspace computation ──────────────────────────────────────

export interface Workspace3DResult {
  xs: number[]
  ys: number[]
  zs: number[]
}

export function computeWorkspace3D(joints: WorkspaceJoint[]): Workspace3DResult {
  const n = joints.length
  const xs: number[] = [], ys: number[] = [], zs: number[] = []

  if (n === 0) return { xs: [0], ys: [0], zs: [0] }

  const vals = new Array(n).fill(0) as number[]
  const pushEE = () => {
    const pts = computeFK3DPure(joints, vals)
    const [x, y, z] = pts[pts.length - 1]
    xs.push(x); ys.push(y); zs.push(z)
  }

  if (n <= 3) {
    const N = n === 1 ? 180 : n === 2 ? 40 : 25
    const recurse = (depth: number) => {
      if (depth === n) { pushEE(); return }
      const j = joints[depth]
      for (let k = 0; k < N; k++) {
        vals[depth] = j.type === 'R'
          ? -Math.PI + 2 * Math.PI * k / (N - 1)
          : j.length * k / (N - 1)
        recurse(depth + 1)
      }
    }
    recurse(0)
  } else {
    const nSamples = n <= 4 ? 20000 : 30000
    for (let k = 0; k < nSamples; k++) {
      for (let i = 0; i < n; i++) {
        const j = joints[i]
        vals[i] = j.type === 'R'
          ? (Math.random() - 0.5) * 2 * Math.PI
          : Math.random() * j.length
      }
      pushEE()
    }
  }

  return { xs, ys, zs }
}
