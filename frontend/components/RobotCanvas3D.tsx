'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

export type JointType = 'R' | 'P'

export interface CustomJoint {
  type: JointType
  length: number
  name?: string
}

interface Props {
  joints: CustomJoint[]
  /** For FK mode: radians for R joints, meters for P joints */
  jointValues: number[]
  mode: 'demo' | 'fk'
  onEEUpdate?: (pos: { x: number; y: number; z: number }) => void
}

/* ── 3D Forward Kinematics ─────────────────────────────────────────────────── */

function computeFK3D(joints: CustomJoint[], values: number[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)]
  const T = new THREE.Matrix4()

  for (let i = 0; i < joints.length; i++) {
    const { type, length } = joints[i]
    const q = values[i] ?? 0

    if (type === 'R') {
      const rot = new THREE.Matrix4()
      if (i === 0)      rot.makeRotationY(q)
      else if (i % 2)  rot.makeRotationZ(q)
      else              rot.makeRotationX(q)
      T.multiply(rot)
    } else {
      const d = Math.max(0, Math.min(length, q))
      T.multiply(new THREE.Matrix4().makeTranslation(d, 0, 0))
    }
    T.multiply(new THREE.Matrix4().makeTranslation(length, 0, 0))
    points.push(new THREE.Vector3().applyMatrix4(T))
  }

  return points
}

/* ── Geometry helpers ─────────────────────────────────────────────────────── */

function makeCylinder(scene: THREE.Scene, color: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.038, 0.045, 1, 16)
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 80 })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)
  return mesh
}

function makeSphere(scene: THREE.Scene, r: number, color: number, emissive = false): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, 20, 20)
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 80 })
  if (emissive) {
    mat.emissive = new THREE.Color(color)
    mat.emissiveIntensity = 0.4
  }
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)
  return mesh
}

function setCylinderBetween(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  if (len < 1e-6) return
  mesh.scale.set(1, len, 1)
  mesh.position.copy(a).addScaledVector(dir.clone().normalize(), len / 2)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function RobotCanvas3D({ joints, jointValues, mode, onEEUpdate }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const rafRef      = useRef<number>(0)
  const tRef        = useRef(0)
  const modeRef     = useRef(mode)
  const valuesRef   = useRef(jointValues)
  const onEERef     = useRef(onEEUpdate)
  const linkMeshes  = useRef<THREE.Mesh[]>([])
  const jointMeshes = useRef<THREE.Mesh[]>([])
  const eeMeshRef   = useRef<THREE.Mesh | null>(null)
  const eeGlowRef   = useRef<THREE.PointLight | null>(null)
  const updateArmRef = useRef<((vals: number[]) => void) | null>(null)

  // Keep refs in sync
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { valuesRef.current = jointValues }, [jointValues])
  useEffect(() => { onEERef.current = onEEUpdate }, [onEEUpdate])

  // Setup scene once per joints change
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x080810)

    const cam = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.01, 100)
    cam.position.set(4.5, 3.5, 4.5)
    cam.lookAt(0, 1, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)

    // Lighting
    scene.add(new THREE.AmbientLight(0x3b4f6a, 1.5))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(6, 10, 6)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x4488ff, 0.5)
    fill.position.set(-4, 6, -4)
    scene.add(fill)

    // Grid + axes
    scene.add(new THREE.GridHelper(12, 24, 0x1e293b, 0x0f172a))
    scene.add(new THREE.AxesHelper(0.6))

    function axisLabel(text: string, pos: THREE.Vector3, color: string) {
      const c = document.createElement('canvas')
      c.width = 64; c.height = 64
      const ctx = c.getContext('2d')!
      ctx.fillStyle = color
      ctx.font = 'bold 40px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, 32, 32)
      const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })
      const sp = new THREE.Sprite(mat)
      sp.position.copy(pos)
      sp.scale.set(0.35, 0.35, 1)
      scene.add(sp)
    }
    axisLabel('X', new THREE.Vector3(0.85, 0, 0), '#ef4444')
    axisLabel('Y', new THREE.Vector3(0, 0.85, 0), '#22c55e')
    axisLabel('Z', new THREE.Vector3(0, 0, 0.85), '#3b82f6')

    // Robot arm meshes
    const LINK_COLORS  = [0x2563eb, 0x3b82f6, 0x60a5fa, 0x93c5fd, 0xbfdbfe]
    const JOINT_COLORS = [0x1e3a8a, 0x1d4ed8, 0x2563eb, 0x3b82f6, 0x60a5fa]

    const lMeshes: THREE.Mesh[] = joints.map((_, i) => makeCylinder(scene, LINK_COLORS[i % 5]))
    const jMeshes: THREE.Mesh[] = joints.map((_, i) => makeSphere(scene, i === 0 ? 0.09 : 0.07, JOINT_COLORS[i % 5]))
    const eeMesh = makeSphere(scene, 0.08, 0x00ccff, true)
    const eeGlow = new THREE.PointLight(0x00ccff, 1.0, 1.0)
    scene.add(eeGlow)

    linkMeshes.current  = lMeshes
    jointMeshes.current = jMeshes
    eeMeshRef.current   = eeMesh
    eeGlowRef.current   = eeGlow

    const updateArm = (vals: number[]) => {
      const pts = computeFK3D(joints, vals)
      for (let i = 0; i < joints.length; i++) {
        if (lMeshes[i]) setCylinderBetween(lMeshes[i], pts[i], pts[i + 1])
        if (jMeshes[i]) jMeshes[i].position.copy(pts[i])
      }
      const ee = pts[pts.length - 1]
      if (eeMesh) eeMesh.position.copy(ee)
      if (eeGlow) eeGlow.position.copy(ee)
      if (onEERef.current) onEERef.current({ x: ee.x, y: ee.y, z: ee.z })
    }
    updateArmRef.current = updateArm

    // OrbitControls
    let controls: any = null
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      controls = new OrbitControls(cam, renderer.domElement)
      controls.target.set(0, 1, 0)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.minDistance = 1.5
      controls.maxDistance = 25
      controls.update()
    })

    // Animation loop
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      if (controls) controls.update()

      // Resize
      const w = mount.clientWidth, h = mount.clientHeight
      if (w > 0 && h > 0 && (renderer.domElement.clientWidth !== w || renderer.domElement.clientHeight !== h)) {
        renderer.setSize(w, h)
        cam.aspect = w / h
        cam.updateProjectionMatrix()
      }

      if (modeRef.current === 'demo') {
        tRef.current += 0.012
        const t = tRef.current
        const demo = joints.map((j, i) =>
          j.type === 'R'
            ? (0.35 + 0.65 * Math.sin(t * (0.5 + i * 0.25))) * (i % 2 === 0 ? 1 : -1)
            : j.length * (0.2 + 0.4 * Math.abs(Math.sin(t * 0.4)))
        )
        updateArm(demo)
      } else {
        updateArm(valuesRef.current)
      }

      renderer.render(scene, cam)
    }
    rafRef.current = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => {
      if (!mount) return
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      cam.aspect = mount.clientWidth / mount.clientHeight
      cam.updateProjectionMatrix()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      if (controls) controls.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [joints]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className="w-full h-full" />
}
