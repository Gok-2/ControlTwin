// Schematic 6-axis industrial robot arm — side view, SVG lines only.
// No brand identity. Used as a decorative background element.

export function RobotArmBg({
  className = '',
  opacity  = 0.07,
}: {
  className?: string
  opacity?:  number
}) {
  return (
    <svg
      viewBox="0 0 220 345"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity }}
    >
      {/* ── Ground hatching ─────────────────────────────────────────────── */}
      <line x1="28" y1="330" x2="196" y2="330" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i}
          x1={34 + i * 14} y1={330}
          x2={26 + i * 14} y2={340}
          stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.35"
        />
      ))}

      {/* ── Base plate ──────────────────────────────────────────────────── */}
      <rect x="52" y="314" width="106" height="16" rx="1"
        stroke="currentColor" strokeWidth="1.5" />
      <line x1="52" y1="322" x2="158" y2="322"
        stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.4" />
      <circle cx="66"  cy="322" r="3.5" stroke="currentColor" strokeWidth="0.9" />
      <circle cx="144" cy="322" r="3.5" stroke="currentColor" strokeWidth="0.9" />

      {/* ── Base column / waist body ─────────────────────────────────────── */}
      <rect x="88" y="284" width="40" height="30" rx="2"
        stroke="currentColor" strokeWidth="1.3" />
      <line x1="88" y1="298" x2="128" y2="298"
        stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.4" />

      {/* ── J1 – waist rotation ──────────────────────────────────────────── */}
      <circle cx="108" cy="281" r="21" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="108" cy="281" r="9"  stroke="currentColor" strokeWidth="1"   />
      <circle cx="108" cy="281" r="3"  stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.7" />

      {/* ── Upper shoulder housing ───────────────────────────────────────── */}
      <rect x="90" y="258" width="36" height="23" rx="2"
        stroke="currentColor" strokeWidth="1.2" />

      {/* ── Lower arm  J1-housing → J2 ──────────────────────────────────── */}
      {/* Two parallel lines ≈10 px apart, from (108,259) to J2=(80,177) */}
      <line x1="112" y1="257" x2="85"  y2="175" stroke="currentColor" strokeWidth="2.1" />
      <line x1="103" y1="261" x2="75"  y2="179" stroke="currentColor" strokeWidth="2.1" />
      {/* Cross-braces */}
      <line x1="103" y1="233" x2="112" y2="230" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />
      <line x1="96"  y1="209" x2="105" y2="206" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />

      {/* ── J2 – shoulder / elbow ────────────────────────────────────────── */}
      <ellipse cx="80" cy="177" rx="16" ry="11"
        stroke="currentColor" strokeWidth="1.2" />
      <circle  cx="80" cy="177" r="6"
        stroke="currentColor" strokeWidth="1"   />
      <circle  cx="80" cy="177" r="2"
        stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.6" />

      {/* ── Upper arm  J2 → J3 ───────────────────────────────────────────── */}
      {/* From (80,177) to (120,102), width ≈8 */}
      <line x1="83"  y1="170" x2="123" y2="95"  stroke="currentColor" strokeWidth="1.9" />
      <line x1="75"  y1="182" x2="115" y2="107" stroke="currentColor" strokeWidth="1.9" />
      <line x1="95"  y1="148" x2="105" y2="145" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />

      {/* ── J3 – elbow ───────────────────────────────────────────────────── */}
      <ellipse cx="119" cy="101" rx="13" ry="9"
        stroke="currentColor" strokeWidth="1.1" />
      <circle  cx="119" cy="101" r="4.5"
        stroke="currentColor" strokeWidth="0.9" />

      {/* ── Forearm  J3 → J4 ─────────────────────────────────────────────── */}
      {/* From (119,101) to (149,78), width ≈6 */}
      <line x1="122" y1="95"  x2="151" y2="72"  stroke="currentColor" strokeWidth="1.6" />
      <line x1="114" y1="107" x2="144" y2="84"  stroke="currentColor" strokeWidth="1.6" />

      {/* ── J4 – wrist roll ──────────────────────────────────────────────── */}
      <circle cx="148" cy="78" r="10"  stroke="currentColor" strokeWidth="1.1" />
      <circle cx="148" cy="78" r="4.5" stroke="currentColor" strokeWidth="0.8" />

      {/* ── Wrist link  J4 → J5 ──────────────────────────────────────────── */}
      {/* From (148,78) to (167,58), width ≈4 */}
      <line x1="152" y1="72"  x2="170" y2="52"  stroke="currentColor" strokeWidth="1.3" />
      <line x1="145" y1="74"  x2="163" y2="54"  stroke="currentColor" strokeWidth="1.3" />

      {/* ── J5 – wrist pitch ─────────────────────────────────────────────── */}
      <circle cx="167" cy="53" r="7.5" stroke="currentColor" strokeWidth="1"   />
      <circle cx="167" cy="53" r="3"   stroke="currentColor" strokeWidth="0.7" />

      {/* ── Tool mount  J5 → J6 ──────────────────────────────────────────── */}
      <line x1="172" y1="48" x2="180" y2="38" stroke="currentColor" strokeWidth="1.1" />

      {/* ── J6 – tool flange ─────────────────────────────────────────────── */}
      <rect x="176" y="31" width="19" height="12" rx="1.5"
        stroke="currentColor" strokeWidth="1" />
      <circle cx="181" cy="37" r="2.5" stroke="currentColor" strokeWidth="0.7" />
      <circle cx="191" cy="37" r="2.5" stroke="currentColor" strokeWidth="0.7" />
      <line x1="181" y1="31" x2="181" y2="43"
        stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.45" />

      {/* ── Axis labels ──────────────────────────────────────────────────── */}
      <text x="121" y="285" fontSize="7.5" fill="currentColor" fontFamily="monospace" fillOpacity="0.65">1</text>
      <text x="57"  y="181" fontSize="7.5" fill="currentColor" fontFamily="monospace" fillOpacity="0.65">2</text>
      <text x="128" y="99"  fontSize="7.5" fill="currentColor" fontFamily="monospace" fillOpacity="0.65">3</text>
      <text x="155" y="75"  fontSize="7.5" fill="currentColor" fontFamily="monospace" fillOpacity="0.65">4</text>
      <text x="175" y="51"  fontSize="7.5" fill="currentColor" fontFamily="monospace" fillOpacity="0.65">5</text>
      <text x="197" y="35"  fontSize="7.5" fill="currentColor" fontFamily="monospace" fillOpacity="0.65">6</text>
    </svg>
  )
}
