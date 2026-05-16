import numpy as np
from scipy.integrate import solve_ivp


class RobotDynamics:
    """2-DOF non-linear robot manipulator with Computed Torque Control."""

    # System parameters
    p1 = 3.473   # joint 1 inertia composite
    p2 = 0.193   # joint 2 inertia
    p3 = 0.242   # coupling inertia term
    p4 = 5.3     # viscous friction — joint 1
    p5 = 1.1     # viscous friction — joint 2

    def __init__(self):
        self.state = np.zeros(4)   # [q1, q2, dq1, dq2]
        self.t = 0.0

    # ── Inertia matrix M(q) ───────────────────────────────────────────────────

    def M(self, q: np.ndarray) -> np.ndarray:
        c2 = np.cos(q[1])
        return np.array([
            [self.p1 + self.p2 + 2 * self.p3 * c2,  self.p2 + self.p3 * c2],
            [self.p2 + self.p3 * c2,                  self.p2],
        ])

    # ── Coriolis / centrifugal matrix Vm(q, dq) ───────────────────────────────

    def Vm(self, q: np.ndarray, dq: np.ndarray) -> np.ndarray:
        h = -self.p3 * np.sin(q[1])
        return np.array([
            [h * dq[1],   h * (dq[0] + dq[1])],
            [-h * dq[0],  0.0],
        ])

    # ── Friction matrix Fd (diagonal) ─────────────────────────────────────────

    def Fd(self) -> np.ndarray:
        return np.diag([self.p4, self.p5])

    # ── Desired trajectory: qd = sin(t) for both joints ──────────────────────

    @staticmethod
    def desired(t: float):
        qd   = np.array([ np.sin(t),  np.sin(t)])
        dqd  = np.array([ np.cos(t),  np.cos(t)])
        ddqd = np.array([-np.sin(t), -np.sin(t)])
        return qd, dqd, ddqd

    # ── Computed Torque Control ───────────────────────────────────────────────
    # τ = M(q)·v + Vm(q,dq)·dq + Fd·dq
    # v = ddqd + Kr·(dqd − dq) + α·(qd − q)
    # Closed-loop error dynamics: ë + Kr·ė + α·e = 0

    def torque(self, t, q, dq, Kr, alpha):
        qd, dqd, ddqd = self.desired(t)
        e   = qd  - q
        de  = dqd - dq
        v   = ddqd + Kr * de + alpha * e
        tau = self.M(q) @ v + self.Vm(q, dq) @ dq + self.Fd() @ dq
        return tau, e

    # ── ODE right-hand side ───────────────────────────────────────────────────

    def _ode(self, t, state, Kr, alpha):
        q, dq = state[:2], state[2:]
        tau, _ = self.torque(t, q, dq, Kr, alpha)
        ddq = np.linalg.solve(
            self.M(q),
            tau - self.Vm(q, dq) @ dq - self.Fd() @ dq,
        )
        return np.concatenate([dq, ddq])

    # ── Advance simulation by one timestep ───────────────────────────────────

    def step(self, dt: float, Kr: float, alpha: float):
        sol = solve_ivp(
            self._ode,
            [self.t, self.t + dt],
            self.state,
            args=(Kr, alpha),
            method="RK45",
            max_step=dt / 2,
        )
        self.state = sol.y[:, -1]
        self.t += dt
        qd, _, _ = self.desired(self.t)
        e = qd - self.state[:2]
        return self.state[:2].copy(), e.copy(), qd.copy()
