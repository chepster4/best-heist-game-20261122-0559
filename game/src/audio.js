// Tiny synthesized sounds (WebAudio, no audio files): a pickup chime, a vault crack,
// a decoy clink, an alarm tick, a caught sting and a getaway arpeggio. The context is
// created on the first user gesture, so a page that only stages screenshots stays silent.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext ?? window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, at, dur, type, gain) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0, ctx.currentTime + at);
    amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + at + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(880, 0, 0.12, 'sine', 0.12);
      tone(1318, 0.07, 0.16, 'sine', 0.1);
    },
    vault() {
      tone(220, 0, 0.1, 'square', 0.08);
      tone(330, 0.09, 0.1, 'square', 0.08);
      tone(440, 0.18, 0.22, 'square', 0.08);
    },
    decoy() {
      tone(1567, 0, 0.08, 'triangle', 0.12);
      tone(1567, 0.12, 0.08, 'triangle', 0.08);
    },
    spotted() {
      tone(110, 0, 0.35, 'sawtooth', 0.1);
      tone(165, 0.05, 0.3, 'sawtooth', 0.08);
    },
    caught() {
      tone(196, 0, 0.5, 'sawtooth', 0.12);
      tone(147, 0.15, 0.6, 'sawtooth', 0.12);
      tone(98, 0.3, 0.8, 'sawtooth', 0.12);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, i * 0.12, 0.3, 'triangle', 0.12));
    },
  };
}
