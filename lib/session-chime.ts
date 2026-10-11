let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    const Ctx = window.AudioContext;
    audio = new Ctx();
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

export function primeSessionAudio() {
  try {
    context();
  } catch {
    // Autoplay policies can block audio until a later gesture.
  }
}

export function playSessionChime(phase: "focus" | "break") {
  try {
    const ctx = context();
    if (!ctx) return;
    const notes = phase === "focus" ? [523.25, 659.25, 783.99] : [392, 329.63];
    const start = ctx.currentTime + 0.02;
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + index * 0.14;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(phase === "focus" ? 0.07 : 0.05, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.46);
    });
  } catch {
    // A missing audio device should not block the session record.
  }
}
