export interface ProgressController {
  onProgress: (progress: number) => void
  markMtlLoaded: () => void
  markObjLoaded: () => void
  updateObjProgress: (loaded: number, total: number) => void
  cancel: () => void
}

export function createProgressController(onProgress: ((progress: number) => void) | undefined): ProgressController {
  let simTimer: ReturnType<typeof setInterval> | null = null
  let simulated = 0

  const startSimulation = () => {
    if (simTimer) return
    simTimer = setInterval(() => {
      simulated = Math.min(90, simulated + 3)
      onProgress?.(simulated)
    }, 100)
  }

  const stopSimulation = () => {
    if (simTimer) {
      clearInterval(simTimer)
      simTimer = null
    }
  }

  return {
    onProgress: (progress: number) => {
      simulated = progress
      onProgress?.(progress)
    },
    markMtlLoaded: () => {
      simulated = 30
      onProgress?.(30)
      startSimulation()
    },
    markObjLoaded: () => {
      stopSimulation()
      onProgress?.(100)
    },
    updateObjProgress: (loaded: number, total: number) => {
      if (total > 0) {
        stopSimulation()
        const p = 30 + (loaded / total) * 65
        onProgress?.(Math.min(95, Math.round(p)))
      }
    },
    cancel: () => {
      stopSimulation()
    },
  }
}