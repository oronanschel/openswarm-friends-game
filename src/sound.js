const KEY = 'friends-game-muted';

// Each effect is a list of [frequency Hz, start s, length s] square-wave blips.
export const Effects = {
  pickup: [[660, 0, 0.07], [880, 0.07, 0.09]],
  chop: [[140, 0, 0.09], [100, 0.08, 0.12]],
  eat: [[440, 0, 0.07], [550, 0.07, 0.07], [660, 0.14, 0.1]],
  friend: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]],
  boostEnd: [[550, 0, 0.08], [440, 0.08, 0.08], [330, 0.16, 0.12]],
  nope: [[200, 0, 0.12]],
};

const VOLUME = 0.06;

// Tiny synthesized sound effects. The AudioContext is created on the first
// play, which follows a key press or tap, so browsers allow it. Without
// WebAudio or storage everything is a quiet no-op.
export class Sound {
  constructor(storage, AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.storage = storage;
    this.AudioCtx = AudioCtx;
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = storage?.getItem(KEY) === '1';
    } catch {
      // Storage unavailable: start unmuted.
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      this.storage?.setItem(KEY, this.muted ? '1' : '0');
    } catch {
      // The choice just won't persist.
    }
    return this.muted;
  }

  play(name) {
    const notes = Effects[name];
    if (this.muted || !notes || !this.AudioCtx) return false;
    try {
      this.ctx ??= new this.AudioCtx();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      for (const [freq, start, length] of notes) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(VOLUME, now + start);
        gain.gain.linearRampToValueAtTime(0, now + start + length);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + length);
      }
      return true;
    } catch {
      return false;
    }
  }
}
