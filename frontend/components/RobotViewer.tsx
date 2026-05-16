'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type RobotType = '2dof' | '3dof' | 'scara' | 'delta'

interface Props {
  robotType: RobotType
}

/* ── Per-robot palette ────────────────────────────────────────────────────── */
const PALETTES: Record<RobotType, { link: number; joint: number; ee: number; trail: number }> = {
  '2dof':  { link: 0x0055bb, joint: 0x00ccff, ee: 0xff5500, trail: 0x22d3ee },
  '3dof':  { link: 0x5522aa, joint: 0xaa88ff, ee: 0xff33aa, trail: 0xa78bfa },
  'scara': { link: 0x005533, joint: 0x00cc66, ee: 0xffaa00, trail: 0x34d399 },
  'delta': { link: 0x774400, joint: 0xffaa00, ee: 0xff3333, trail: 0xf59e0b },
}

/* ── Shared geometry helpers (injected per scene) ────────────────────────── */
function makeHelpers(scene: THREE.Scene) {
  const quat = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)

  function mkStd(color: number, emissive: number, opts: object = {}) {
    return new THREE.MeshStandardMaterial({ color, emissive, metalness: 0.75, roughness: 0.2, ...opts })
  }

  function mkLink(mat: THREE.Material, r: number) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat)
    m.castShadow = true
    scene.add(m)
    return m
  }

  function mkSphere(r: number, mat: THREE.Material) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat)
    m.castShadow = true
    scene.add(m)
    return m
  }

  function posLink(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    const dir = to.clone().sub(from)
    const len = dir.length()
    if (len < 1e-4) return
    mesh.scale.setY(len)
    mesh.position.copy(from).lerp(to, 0.5)
    quat.setFromUnitVectors(up, dir.normalize())
    mesh.quaternion.copy(quat)
  }

  return { mkStd, mkLink, mkSphere, posLink }
}

/* ── Robot-specific builders ──────────────────────────────────────────────── */

function build2DOF(scene: THREE.Scene, pal: typeof PALETTES['2dof']) {
  const { mkStd, mkLink, mkSphere, posLink } = makeHelpers(scene)
  const mL = mkStd(pal.link, 0x001133)
  const mJ = mkStd(pal.joint, 0x003355)
  const mE = mkStd(pal.ee, 0x441100)
  const L1 = 1.5, L2 = 1.1
  const link1 = mkLink(mL, 0.065), link2 = mkLink(mL, 0.050)
  const j1 = mkSphere(0.11, mJ), j2 = mkSphere(0.09, mJ), ee = mkSphere(0.08, mE)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.22, 24), mkStd(0x334455, 0x111a22))
  base.position.set(0, -0.11, 0)
  scene.add(base)

  const j0 = new THREE.Vector3(0, 0, 0)
  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3()

  return (t: number) => {
    const q1 = 0.6 * Math.sin(0.42 * t)
    const q2 = 0.9 * Math.sin(0.65 * t + 0.4)
    p1.set(L1 * Math.cos(q1), L1 * Math.sin(q1), 0)
    p2.set(p1.x + L2 * Math.cos(q1 + q2), p1.y + L2 * Math.sin(q1 + q2), 0)
    posLink(link1, j0, p1)
    posLink(link2, p1, p2)
    j1.position.copy(p1)
    j2.position.copy(p2)
    ee.position.copy(p2)
    return p2.clone()
  }
}

function build3DOF(scene: THREE.Scene, pal: typeof PALETTES['3dof']) {
  const { mkStd, mkLink, mkSphere, posLink } = makeHelpers(scene)
  const mL = mkStd(pal.link, 0x110033)
  const mJ = mkStd(pal.joint, 0x220055)
  const mE = mkStd(pal.ee, 0x330022)
  const L1 = 1.2, L2 = 0.85, L3 = 0.55
  const link1 = mkLink(mL, 0.065), link2 = mkLink(mL, 0.055), link3 = mkLink(mL, 0.042)
  const j1 = mkSphere(0.11, mJ), j2 = mkSphere(0.09, mJ), j3 = mkSphere(0.07, mJ)
  const ee = mkSphere(0.08, mkStd(pal.ee, 0x330022))
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.22, 24), mkStd(0x334455, 0x111a22))
  base.position.set(0, -0.11, 0)
  scene.add(base)

  const j0 = new THREE.Vector3(0, 0, 0)
  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3()

  return (t: number) => {
    const q1 = 0.55 * Math.sin(0.28 * t)         // waist (Y-rotation)
    const q2 = 0.35 + 0.40 * Math.sin(0.50 * t)  // shoulder pitch
    const q3 = -0.30 + 0.45 * Math.sin(0.70 * t + 0.6) // elbow

    const cw = Math.cos(q1), sw = Math.sin(q1)   // waist
    // Link 1: from j0 upward at shoulder angle q2, in waist plane
    p1.set(L1 * Math.sin(q2) * cw, L1 * Math.cos(q2), L1 * Math.sin(q2) * sw)
    // Link 2: from p1, elbow bend in same vertical plane
    const a2 = q2 + q3
    p2.set(p1.x + L2 * Math.sin(a2) * cw, p1.y + L2 * Math.cos(a2), p1.z + L2 * Math.sin(a2) * sw)
    // Link 3: fixed wrist offset
    const a3 = a2 - 0.3
    p3.set(p2.x + L3 * Math.sin(a3) * cw, p2.y + L3 * Math.cos(a3), p2.z + L3 * Math.sin(a3) * sw)

    posLink(link1, j0, p1)
    posLink(link2, p1, p2)
    posLink(link3, p2, p3)
    j1.position.copy(p1)
    j2.position.copy(p2)
    j3.position.copy(p3)
    ee.position.copy(p3)
    return p3.clone()
  }
}

function buildSCARA(scene: THREE.Scene, pal: typeof PALETTES['scara']) {
  const { mkStd, mkLink, mkSphere, posLink } = makeHelpers(scene)
  const mL = mkStd(pal.link, 0x001122)
  const mJ = mkStd(pal.joint, 0x002211)
  const mE = mkStd(pal.ee, 0x332200)
  const mA = mkStd(0x222222, 0x000000, { transparent: true, opacity: 0.5 })
  const L1 = 0.65, L2 = 0.48

  // Column / body
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 1.8, 16), mkStd(0x1a2a1a, 0x050f05))
  col.position.set(0, -0.1, 0)
  scene.add(col)

  const link1 = mkLink(mL, 0.055), link2 = mkLink(mL, 0.045)
  const jBase = mkSphere(0.12, mJ), j1 = mkSphere(0.09, mJ), j2 = mkSphere(0.07, mJ)
  const act = mkLink(mA, 0.035)  // vertical actuator
  const ee = mkSphere(0.07, mkStd(pal.ee, 0x332200))

  const base = new THREE.Vector3(0, 0.8, 0)
  jBase.position.copy(base)
  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), pEE = new THREE.Vector3()

  return (t: number) => {
    const q1 = 0.70 * Math.sin(0.40 * t)
    const q2 = 0.55 * Math.sin(0.62 * t + 0.4)
    const d3 = 0.25 + 0.15 * Math.sin(0.85 * t)

    p1.set(base.x + L1 * Math.cos(q1), base.y, base.z + L1 * Math.sin(q1))
    p2.set(p1.x + L2 * Math.cos(q1 + q2), p1.y, p1.z + L2 * Math.sin(q1 + q2))
    pEE.set(p2.x, p2.y - d3, p2.z)

    posLink(link1, base, p1)
    posLink(link2, p1, p2)
    posLink(act, p2, pEE)
    j1.position.copy(p1)
    j2.position.copy(p2)
    ee.position.copy(pEE)
    return pEE.clone()
  }
}

function buildDelta(scene: THREE.Scene, pal: typeof PALETTES['delta']) {
  const { mkStd, mkLink, mkSphere, posLink } = makeHelpers(scene)
  const mU = mkStd(pal.link, 0x220a00)
  const mF = mkStd(0x443322, 0x110800, { transparent: true, opacity: 0.7 })
  const mJ = mkStd(pal.joint, 0x221100)
  const mP = mkStd(0x334455, 0x0a1522)

  const Rb = 0.30, Rp = 0.08, La = 0.42, Lf = 0.72
  const Reff = Rb - Rp

  // Fixed top platform (triangle frame)
  for (let i = 0; i < 3; i++) {
    const a = (2 * Math.PI * i) / 3
    const b = (2 * Math.PI * (i + 1)) / 3
    const edge = mkLink(mkStd(0x333344, 0x111122), 0.025)
    const from = new THREE.Vector3(Rb * Math.cos(a), 0.8, Rb * Math.sin(a))
    const to   = new THREE.Vector3(Rb * Math.cos(b), 0.8, Rb * Math.sin(b))
    posLink(edge, from, to)
  }

  // Moving platform
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(Rp * 2, Rp * 2, 0.04, 16), mP)
  scene.add(platform)

  // Three chains: upper arm + forearm + joints
  const chains = Array.from({ length: 3 }, (_, i) => {
    const angle = (2 * Math.PI * i) / 3
    const motor = new THREE.Vector3(Rb * Math.cos(angle), 0.8, Rb * Math.sin(angle))
    const motorJ = mkSphere(0.06, mJ)
    motorJ.position.copy(motor)
    const upper = mkLink(mU, 0.038)
    const fore  = mkLink(mF, 0.025)
    const elbJ  = mkSphere(0.05, mJ)
    return { angle, motor, upper, fore, elbJ }
  })

  const eePos = new THREE.Vector3()
  const ee = mkSphere(0.09, mkStd(pal.ee, 0x330000))

  return (t: number) => {
    const theta = -0.60 + 0.28 * Math.sin(0.40 * t)
    const zEE = La * Math.sin(theta) - Math.sqrt(Math.max(0, Lf * Lf - (Reff + La * Math.cos(theta)) ** 2))
    eePos.set(0, zEE + 0.8, 0)

    chains.forEach(({ angle, motor, upper, fore, elbJ }) => {
      // Upper arm end
      const ua = new THREE.Vector3(
        motor.x + La * Math.cos(angle) * Math.cos(theta),
        motor.y + La * Math.sin(theta),
        motor.z + La * Math.sin(angle) * Math.cos(theta),
      )
      // Forearm attachment on platform
      const pa = new THREE.Vector3(
        eePos.x + Rp * Math.cos(angle),
        eePos.y,
        eePos.z + Rp * Math.sin(angle),
      )
      posLink(upper, motor, ua)
      posLink(fore, ua, pa)
      elbJ.position.copy(ua)
    })

    platform.position.copy(eePos)
    ee.position.copy(eePos)
    return eePos.clone()
  }
}

/* ── Main component ───────────────────────────────────────────────────────── */

export default function RobotViewer({ robotType }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current!
    const W = mount.clientWidth, H = mount.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0f)
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.07)

    // Camera
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 60)
    const camPositions: Record<RobotType, [number, number, number]> = {
      '2dof':  [0.5, 1.5, 5.0],
      '3dof':  [2.5, 1.5, 4.5],
      'scara': [2.0, 2.5, 3.5],
      'delta': [1.5, 2.5, 4.0],
    }
    camera.position.set(...camPositions[robotType])
    camera.lookAt(0, 0.5, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // Lights
    scene.add(new THREE.AmbientLight(0x1a2a4a, 4))
    const dir = new THREE.DirectionalLight(0x6699ff, 5)
    dir.position.set(3, 6, 4)
    dir.castShadow = true
    scene.add(dir)
    const fill = new THREE.PointLight(0x0044ff, 3, 10)
    fill.position.set(-2, 2, 2)
    scene.add(fill)
    const eeLight = new THREE.PointLight(0xff4400, 2, 4)
    scene.add(eeLight)

    // Grid
    const grid = new THREE.GridHelper(10, 24, 0x0d2040, 0x0d1a30)
    grid.position.y = -1.8
    grid.receiveShadow = true
    scene.add(grid)

    // Trail
    const trailPts: number[] = []
    const trailGeo = new THREE.BufferGeometry()
    const pal = PALETTES[robotType]
    const trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: pal.trail, transparent: true, opacity: 0.45 }),
    )
    scene.add(trailLine)

    // Build robot
    let updateFn: (t: number) => THREE.Vector3
    if (robotType === '2dof')  updateFn = build2DOF(scene, pal)
    else if (robotType === '3dof')  updateFn = build3DOF(scene, pal)
    else if (robotType === 'scara') updateFn = buildSCARA(scene, pal)
    else                            updateFn = buildDelta(scene, pal)

    // Animation loop
    const clock = new THREE.Clock()
    let animId: number

    function animate() {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const eePos = updateFn(t)
      eeLight.position.copy(eePos)

      // Trail
      trailPts.push(eePos.x, eePos.y, eePos.z)
      const MAX = 300 * 3
      if (trailPts.length > MAX) trailPts.splice(0, 3)
      trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(trailPts), 3))
      trailGeo.setDrawRange(0, trailPts.length / 3)
      trailGeo.computeBoundingSphere()

      renderer.render(scene, camera)
    }

    animate()

    // Resize
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [robotType])

  return <div ref={mountRef} className="w-full h-full" style={{ background: '#0a0a0f' }} />
}
