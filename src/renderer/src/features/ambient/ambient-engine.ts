import type { AmbientSound } from '@shared/types'

/**
 * AmbientEngine — synthesises calm background textures with the Web Audio API.
 * No audio files are shipped, so everything stays offline and CSP-safe. Each
 * sound is a shaped noise source (optionally modulated) approximating rain,
 * cafe, forest, lo-fi warmth, white/brown noise.
 */
export class AmbientEngine {
  private ctx: AudioContext | null = null
  private nodes: AudioNode[] = []
  private master: GainNode | null = null
  private current: AmbientSound = 'none'
  private volume = 0.6

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private makeNoise(brown = false): AudioBufferSourceNode {
    const ctx = this.ensure()
    const seconds = 4
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      } else {
        data[i] = white
      }
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    return src
  }

  setVolume(v: number): void {
    this.volume = v
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    }
  }

  getCurrent(): AmbientSound {
    return this.current
  }

  async play(sound: AmbientSound): Promise<void> {
    this.stopNodes()
    this.current = sound
    if (sound === 'none') return

    const ctx = this.ensure()
    if (ctx.state === 'suspended') await ctx.resume()
    const master = this.master as GainNode

    const connect = (chain: AudioNode[]): void => {
      for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
      chain[chain.length - 1].connect(master)
      this.nodes.push(...chain)
    }

    const startSources = (): void => {
      for (const n of this.nodes) {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) n.start()
      }
    }

    switch (sound) {
      case 'white-noise': {
        const src = this.makeNoise(false)
        const g = ctx.createGain()
        g.gain.value = 0.25
        connect([src, g])
        break
      }
      case 'brown-noise': {
        const src = this.makeNoise(true)
        const g = ctx.createGain()
        g.gain.value = 0.5
        connect([src, g])
        break
      }
      case 'rain': {
        const src = this.makeNoise(false)
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 800
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 7000
        const g = ctx.createGain()
        g.gain.value = 0.22
        connect([src, hp, lp, g])
        break
      }
      case 'forest': {
        const src = this.makeNoise(false)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1800
        bp.Q.value = 0.6
        const g = ctx.createGain()
        g.gain.value = 0.18
        // slow amplitude sway like wind
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.08
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = 0.08
        lfo.connect(lfoGain).connect(g.gain)
        this.nodes.push(lfo, lfoGain)
        connect([src, bp, g])
        break
      }
      case 'cafe': {
        const src = this.makeNoise(true)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1200
        const g = ctx.createGain()
        g.gain.value = 0.4
        connect([src, lp, g])
        break
      }
      case 'lofi': {
        const src = this.makeNoise(true)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 900
        const g = ctx.createGain()
        g.gain.value = 0.35
        // gentle tremolo for a warm, hazy feel
        const lfo = ctx.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.value = 0.5
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = 0.12
        lfo.connect(lfoGain).connect(g.gain)
        this.nodes.push(lfo, lfoGain)
        connect([src, lp, g])
        break
      }
      default:
        break
    }

    startSources()
  }

  private stopNodes(): void {
    for (const n of this.nodes) {
      try {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) n.stop()
        n.disconnect()
      } catch {
        /* ignore */
      }
    }
    this.nodes = []
  }

  stop(): void {
    this.stopNodes()
    this.current = 'none'
  }
}

export const ambientEngine = new AmbientEngine()
