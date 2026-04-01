const PROC_STATES = {
  RUNNING: 'running',
  SLEEPING: 'sleeping',
  TERMINATED: 'terminated',
  BACKGROUND: 'background',
};

export class ProcessManager {
  constructor(eventBus) {
    this.bus = eventBus;
    this.pidCounter = 100;
    this.processes = new Map();
    this.timer = setInterval(() => this.tick(), 2000);
  }

  spawn({ name, type = 'app', user = 'guest', background = false, meta = {} }) {
    const pid = this.pidCounter++;
    const proc = {
      pid,
      name,
      type,
      user,
      state: background ? PROC_STATES.BACKGROUND : PROC_STATES.RUNNING,
      cpu: +(Math.random() * 8).toFixed(2),
      memory: Math.round(12 + Math.random() * 128),
      startedAt: Date.now(),
      meta,
    };
    this.processes.set(pid, proc);
    this.bus.emit('process:spawn', proc);
    return proc;
  }

  setState(pid, state) {
    const proc = this.processes.get(pid);
    if (!proc) return;
    proc.state = state;
    this.bus.emit('process:update', proc);
  }

  kill(pid) {
    const proc = this.processes.get(pid);
    if (!proc) return false;
    proc.state = PROC_STATES.TERMINATED;
    proc.endedAt = Date.now();
    this.bus.emit('process:exit', proc);
    this.processes.delete(pid);
    return true;
  }

  list() {
    return [...this.processes.values()].sort((a, b) => a.pid - b.pid);
  }

  tick() {
    for (const proc of this.processes.values()) {
      if (proc.state === PROC_STATES.TERMINATED) continue;
      proc.cpu = +(Math.max(0, proc.cpu + (Math.random() - 0.3) * 2)).toFixed(2);
      proc.memory = Math.max(8, Math.round(proc.memory + (Math.random() - 0.2) * 6));
      this.bus.emit('process:metrics', proc);
    }
  }
}

export { PROC_STATES };
