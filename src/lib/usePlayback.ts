import { useCallback, useEffect, useRef, useState } from 'react'

export interface Playback {
  playing: boolean
  /** normalized 0..1 */
  progress: number
  toggle: () => void
  restart: () => void
  seek: (p: number) => void
  pause: () => void
  /** play from the current position and auto-pause once `target` (0..1) is reached */
  playTo: (target: number) => void
  beginScrub: () => void
  endScrub: () => void
}

/**
 * requestAnimationFrame-driven playback clock.
 * `duration` is in seconds, `speed` a multiplier.
 */
export function usePlayback(duration: number, speed: number, loop: boolean): Playback {
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const wasPlayingRef = useRef(false)
  const stopAtRef = useRef<number | null>(null)

  const durationRef = useRef(duration)
  durationRef.current = duration
  const speedRef = useRef(speed)
  speedRef.current = speed
  const loopRef = useRef(loop)
  loopRef.current = loop

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      let p = progressRef.current + (dt * speedRef.current) / durationRef.current
      // segment playback: stop cleanly at a target (used by manual step-through)
      if (stopAtRef.current != null && p >= stopAtRef.current) {
        p = stopAtRef.current
        stopAtRef.current = null
        progressRef.current = p
        setProgress(p)
        setPlaying(false)
        return
      }
      if (p >= 1) {
        if (loopRef.current) {
          p = p % 1
        } else {
          progressRef.current = 1
          setProgress(1)
          setPlaying(false)
          return
        }
      }
      progressRef.current = p
      setProgress(p)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const toggle = useCallback(() => {
    stopAtRef.current = null
    setPlaying((was) => {
      if (!was && progressRef.current >= 1) {
        progressRef.current = 0
        setProgress(0)
      }
      return !was
    })
  }, [])

  const restart = useCallback(() => {
    stopAtRef.current = null
    progressRef.current = 0
    setProgress(0)
    setPlaying(true)
  }, [])

  const seek = useCallback((p: number) => {
    stopAtRef.current = null
    const clamped = Math.min(1, Math.max(0, p))
    progressRef.current = clamped
    setProgress(clamped)
  }, [])

  const pause = useCallback(() => {
    stopAtRef.current = null
    setPlaying(false)
  }, [])

  const playTo = useCallback((target: number) => {
    stopAtRef.current = Math.min(1, Math.max(0, target))
    setPlaying(true)
  }, [])

  const beginScrub = useCallback(() => {
    setPlaying((was) => {
      wasPlayingRef.current = was
      return false
    })
  }, [])

  const endScrub = useCallback(() => {
    if (wasPlayingRef.current && progressRef.current < 1) setPlaying(true)
  }, [])

  return { playing, progress, toggle, restart, seek, pause, playTo, beginScrub, endScrub }
}

/** Observe an element's layout size. Callback ref so it works with conditionally-mounted elements. */
export function useElementSize<T extends HTMLElement>(): [
  (el: T | null) => void,
  { w: number; h: number },
] {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size]
}
