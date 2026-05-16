'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface Props {
  q1: number
  q2: number
  qd1: number
  qd2: number
}

const L1 = 1.5
const L2 = 1.1
const TRAIL_MAX = 300

export default function SimulationCanvas({ q1, q2, qd1, qd2 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  // Keep latest angles in a ref so the animation loop always reads fresh values
  const stateRef = useRef({ q1, q2, qd1, qd2 })
  stateRef.current = { q1, q2, qd1, qd2 }

  useEffect(() => {
    const mount = mountRef.current!
    const W = mount.clientWidth
    const H = mount.clientHeight

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0f)
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.08)

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 60)
    camera.position.set(0.5, 1.5, 5)
    camera.lookAt(0.3, 0.3, 0)

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // ── Lights ────────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a2a4a, 4))

    const dirLight = new THREE.DirectionalLight(0x6699ff, 5)
    dirLight.position.set(3, 6, 4)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    scene.add(dirLight)

    const fillLight = new THREE.PointLight(0x0044ff, 3, 10)
    fillLight.position.set(-2, 2, 2)
    scene.add(fillLight)

    const eeLight = new THREE.PointLight(0xff4400, 2, 4)
    scene.add(eeLight)  // will track the end effector

    // ── Grid floor ────────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(10, 24, 0x0d2040, 0x0d1a30)
    grid.position.y = -1.8
    grid.receiveShadow = true
    scene.add(grid)

    // ── Materials ─────────────────────────────────────────────────────────────
    const mkStd = (color: number, emissive = 0x000000, opts = {}) =>
      new THREE.MeshStandardMaterial({
        color, emissive, metalness: 0.75, roughness: 0.2, ...opts,
      })

    const matLink   = mkStd(0x0066cc, 0x001133)
    const matJoint  = mkStd(0x00ccff, 0x003355)
    const matEE     = mkStd(0xff5500, 0x441100)
    const matDesired = mkStd(0x00ff66, 0x004422, { transparent: true, opacity: 0.35 })
    const matBase   = mkStd(0x334455, 0x111a22)

    // ── Base ──────────────────────────────────────────────────────────────────
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 24), matBase)
    base.position.set(0, -0.12, 0)
    base.castShadow = true
    scene.add(base)

    // Helper: create a single link (unit-height cylinder scaled to actual length)
    function makeLink(mat: THREE.Material, r: number) {
      const geo = new THREE.CylinderGeometry(r, r, 1, 12)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      return mesh
    }

    // Actual arm links + desired (ghost) arm links
    const link1     = makeLink(matLink,    0.065)
    const link2     = makeLink(matLink,    0.050)
    const dLink1    = makeLink(matDesired, 0.065)
    const dLink2    = makeLink(matDesired, 0.050)

    // Joints
    const mkSphere = (r: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat)
      m.castShadow = true
      return m
    }

    const joint1  = mkSphere(0.11, matJoint)
    const joint2  = mkSphere(0.09, matJoint)
    const endEff  = mkSphere(0.08, matEE)
    const dEndEff = mkSphere(0.07, matDesired)

    scene.add(link1, link2, dLink1, dLink2, joint1, joint2, endEff, dEndEff)

    // ── End-effector trail ────────────────────────────────────────────────────
    const trailPts: number[] = []
    const trailGeo = new THREE.BufferGeometry()
    const trailMat = new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.5 })
    const trailLine = new THREE.Line(trailGeo, trailMat)
    scene.add(trailLine)

    // ── Helper: position and orient a unit-length link mesh ───────────────────
    const _quat = new THREE.Quaternion()
    const _up   = new THREE.Vector3(0, 1, 0)

    function positionLink(
      mesh: THREE.Mesh,
      start: THREE.Vector3,
      end: THREE.Vector3,
    ) {
      const dir = end.clone().sub(start)
      const len = dir.length()
      if (len < 1e-4) return
      mesh.scale.set(1, len, 1)
      mesh.position.copy(start).add(end).multiplyScalar(0.5)
      _quat.setFromUnitVectors(_up, dir.normalize())
      mesh.quaternion.copy(_quat)
    }

    // ── Forward kinematics ────────────────────────────────────────────────────
    const j0 = new THREE.Vector3(0, 0, 0)
    const j1 = new THREE.Vector3()
    const j2 = new THREE.Vector3()
    const dj1 = new THREE.Vector3()
    const dj2 = new THREE.Vector3()

    function fk(q1: number, q2: number, p1: THREE.Vector3, p2: THREE.Vector3) {
      p1.set(L1 * Math.cos(q1), L1 * Math.sin(q1), 0)
      p2.set(
        p1.x + L2 * Math.cos(q1 + q2),
        p1.y + L2 * Math.sin(q1 + q2),
        0,
      )
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let animId: number

    function animate() {
      animId = requestAnimationFrame(animate)

      const { q1, q2, qd1, qd2 } = stateRef.current

      fk(q1, q2, j1, j2)
      fk(qd1, qd2, dj1, dj2)

      positionLink(link1, j0, j1)
      positionLink(link2, j1, j2)
      positionLink(dLink1, j0, dj1)
      positionLink(dLink2, dj1, dj2)

      joint1.position.copy(j1)
      joint2.position.copy(j2)
      endEff.position.copy(j2)
      dEndEff.position.copy(dj2)

      // end-effector point light tracks the actual arm tip
      eeLight.position.copy(j2)

      // Trail update — grow up to TRAIL_MAX, then slide window
      trailPts.push(j2.x, j2.y, j2.z)
      const maxFloats = TRAIL_MAX * 3
      if (trailPts.length > maxFloats) trailPts.splice(0, 3)
      trailGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(trailPts), 3),
      )
      trailGeo.setDrawRange(0, trailPts.length / 3)

      renderer.render(scene, camera)
    }

    animate()

    // ── Resize handling ───────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, []) // run once; live data comes through stateRef

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      style={{ background: '#0a0a0f' }}
    >
      {/* Legend overlay */}
      <div className="absolute top-12 right-4 flex flex-col gap-2 pointer-events-none">
        <LegendItem color="#0088ff" label="Actual arm" />
        <LegendItem color="#00ff66" label="Desired arm" opacity />
        <LegendItem color="#00ccff" label="EE trail" />
      </div>
    </div>
  )
}

function LegendItem({
  color, label, opacity = false,
}: { color: string; label: string; opacity?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
      <div
        className="w-3 h-3 rounded-sm"
        style={{ background: color, opacity: opacity ? 0.5 : 1 }}
      />
      {label}
    </div>
  )
}
