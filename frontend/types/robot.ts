export interface RobotState {
  t: number
  q1: number
  q2: number
  qd1: number
  qd2: number
  e1: number
  e2: number
  Kr: number
  alpha: number
}

export interface ControlGains {
  Kr: number
  alpha: number
}
