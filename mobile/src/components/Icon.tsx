import Svg, { Circle, Path, Rect } from 'react-native-svg'

/**
 * Line icons from the prototype (24px grid, lucide-style). Generated from
 * prototype/js/icons.js: each entry is a list of [tag, attributes].
 */
type El = [string, Record<string, string | number>]

const ICONS = {
  home: [["path",{"d":"M3 10.5 12 3l9 7.5"}],["path",{"d":"M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"}]],
  users: [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{"cx":9,"cy":7,"r":4}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["path",{"d":"M16 3.13a4 4 0 0 1 0 7.75"}]],
  records: [["rect",{"x":8,"y":2,"width":8,"height":4,"rx":1}],["path",{"d":"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"}],["path",{"d":"M9 12h6M9 16h4"}]],
  layers: [["path",{"d":"m12 2 10 5-10 5L2 7l10-5z"}],["path",{"d":"m2 17 10 5 10-5"}],["path",{"d":"m2 12 10 5 10-5"}]],
  chart: [["path",{"d":"M3 3v18h18"}],["path",{"d":"M18 17V9"}],["path",{"d":"M13 17V5"}],["path",{"d":"M8 17v-3"}]],
  search: [["circle",{"cx":11,"cy":11,"r":7}],["path",{"d":"m21 21-4.3-4.3"}]],
  phone: [["path",{"d":"M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"}]],
  pin: [["path",{"d":"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"}],["circle",{"cx":12,"cy":10,"r":3}]],
  calendar: [["rect",{"x":3,"y":4,"width":18,"height":18,"rx":2}],["path",{"d":"M16 2v4M8 2v4M3 10h18"}]],
  chevR: [["path",{"d":"m9 18 6-6-6-6"}]],
  chevL: [["path",{"d":"m15 18-6-6 6-6"}]],
  chevD: [["path",{"d":"m6 9 6 6 6-6"}]],
  plus: [["path",{"d":"M12 5v14M5 12h14"}]],
  minus: [["path",{"d":"M5 12h14"}]],
  check: [["path",{"d":"M20 6 9 17l-5-5"}]],
  checkCircle: [["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"m8.5 12 2.5 2.5 4.5-5"}]],
  x: [["path",{"d":"M18 6 6 18M6 6l12 12"}]],
  alert: [["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"}],["path",{"d":"M12 9v4M12 17h.01"}]],
  alertCircle: [["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M12 8v4M12 16h.01"}]],
  clock: [["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M12 6v6l4 2"}]],
  trophy: [["path",{"d":"M6 9H4.5a2.5 2.5 0 0 1 0-5H6"}],["path",{"d":"M18 9h1.5a2.5 2.5 0 0 0 0-5H18"}],["path",{"d":"M4 22h16"}],["path",{"d":"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"}],["path",{"d":"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"}],["path",{"d":"M18 2H6v7a6 6 0 0 0 12 0V2Z"}]],
  printer: [["path",{"d":"M6 9V2h12v7"}],["path",{"d":"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"}],["rect",{"x":6,"y":14,"width":12,"height":8,"rx":1}]],
  refresh: [["path",{"d":"M21 12a9 9 0 0 1-15.5 6.2L3 16"}],["path",{"d":"M3 21v-5h5"}],["path",{"d":"M3 12a9 9 0 0 1 15.5-6.2L21 8"}],["path",{"d":"M21 3v5h-5"}]],
  sliders: [["path",{"d":"M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"}]],
  logout: [["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}],["path",{"d":"m16 17 5-5-5-5"}],["path",{"d":"M21 12H9"}]],
  bell: [["path",{"d":"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"}],["path",{"d":"M10.3 21a1.94 1.94 0 0 0 3.4 0"}]],
  user: [["circle",{"cx":12,"cy":8,"r":4}],["path",{"d":"M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"}]],
  edit: [["path",{"d":"M12 20h9"}],["path",{"d":"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"}]],
  eye: [["path",{"d":"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"}],["circle",{"cx":12,"cy":12,"r":3}]],
  eyeOff: [["path",{"d":"M9.88 9.88a3 3 0 1 0 4.24 4.24"}],["path",{"d":"M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"}],["path",{"d":"M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"}],["path",{"d":"m2 2 20 20"}]],
  lock: [["rect",{"x":3,"y":11,"width":18,"height":11,"rx":2}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],
  idcard: [["rect",{"x":3,"y":4,"width":18,"height":16,"rx":2}],["circle",{"cx":9,"cy":10,"r":2}],["path",{"d":"M15 8h3M15 12h3M6 16h12"}]],
  cash: [["rect",{"x":2,"y":6,"width":20,"height":12,"rx":2}],["circle",{"cx":12,"cy":12,"r":2.5}],["path",{"d":"M6 12h.01M18 12h.01"}]],
  upi: [["rect",{"x":5,"y":2,"width":14,"height":20,"rx":2}],["path",{"d":"M12 18h.01"}]],
  bank: [["path",{"d":"M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7"}],["path",{"d":"m12 2 8 5H4z"}]],
  receipt: [["path",{"d":"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"}],["path",{"d":"M16 8H8M16 12H8M13 16H8"}]],
  share: [["circle",{"cx":18,"cy":5,"r":3}],["circle",{"cx":6,"cy":12,"r":3}],["circle",{"cx":18,"cy":19,"r":3}],["path",{"d":"m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"}]],
  trash: [["path",{"d":"M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"}]],
  moon: [["path",{"d":"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"}]],
  globe: [["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"}]],
  bluetooth: [["path",{"d":"m7 7 10 10-5 5V2l5 5L7 17"}]],
  help: [["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"}]],
  info: [["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M12 16v-4M12 8h.01"}]],
  coins: [["circle",{"cx":8,"cy":8,"r":6}],["path",{"d":"M18.09 10.37A6 6 0 1 1 10.34 18"}],["path",{"d":"M7 6h1v4"}],["path",{"d":"m16.71 13.88.7.71-2.82 2.82"}]],
  star: [["path",{"d":"m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"}]],
  target: [["circle",{"cx":12,"cy":12,"r":10}],["circle",{"cx":12,"cy":12,"r":6}],["circle",{"cx":12,"cy":12,"r":2}]],
  wallet: [["path",{"d":"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"}],["path",{"d":"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"}]],
  route: [["circle",{"cx":6,"cy":19,"r":3}],["path",{"d":"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"}],["circle",{"cx":18,"cy":5,"r":3}]],
  inbox: [["path",{"d":"M22 12h-6l-2 3h-4l-2-3H2"}],["path",{"d":"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}]],
  more: [["circle",{"cx":12,"cy":12,"r":1}],["circle",{"cx":19,"cy":12,"r":1}],["circle",{"cx":5,"cy":12,"r":1}]],
  userPlus: [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{"cx":9,"cy":7,"r":4}],["path",{"d":"M19 8v6M22 11h-6"}]],
  shield: [["path",{"d":"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"}]],
  gavel: [["path",{"d":"m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10"}],["path",{"d":"m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"}]],
  sync: [["path",{"d":"M20 7h-9a4 4 0 0 0 0 8h1"}],["path",{"d":"m17 4 3 3-3 3"}],["path",{"d":"M4 17h9a4 4 0 0 0 0-8h-1"}],["path",{"d":"m7 20-3-3 3-3"}]],
  rupee: [["path",{"d":"M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"}]],
  trend: [["path",{"d":"m22 7-8.5 8.5-5-5L2 17"}],["path",{"d":"M16 7h6v6"}]],
}

export type IconName = keyof typeof ICONS

export function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.8,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {(ICONS[name] as unknown as El[]).map(([tag, a], i) =>
        tag === 'circle' ? (
          <Circle key={i} cx={a.cx} cy={a.cy} r={a.r} />
        ) : tag === 'rect' ? (
          <Rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} />
        ) : (
          <Path key={i} d={String(a.d)} />
        ),
      )}
    </Svg>
  )
}
