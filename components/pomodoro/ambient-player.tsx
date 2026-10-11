"use client";

import { Surface } from "@/components/ui/surface";
import {
  AMBIENT_TRACKS,
  getAmbientServerSnapshot,
  getAmbientSnapshot,
  setAmbientTrack,
  setAmbientVolume,
  subscribeAmbient,
  type AmbientTrackId,
} from "@/lib/ambient-audio";
import { cn } from "@/lib/cn";
import { CloudRain, Coffee, Droplets, Flame, Moon, Trees, Volume2, Waves } from "lucide-react";
import { useSyncExternalStore } from "react";

const icons = {
  rain: CloudRain,
  cafe: Coffee,
  forest: Trees,
  waves: Waves,
  fire: Flame,
  stream: Droplets,
  night: Moon,
} as const;

export function AmbientPlayer() {
  const ambient = useSyncExternalStore(subscribeAmbient, getAmbientSnapshot, getAmbientServerSnapshot);
  const active = AMBIENT_TRACKS.find((track) => track.id === ambient.track) ?? AMBIENT_TRACKS[0];

  return (
    <Surface className="mx-auto mt-5 w-full max-w-xl p-5" delay={0.08}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-[#8a847c]">AMBIENCE</p>
          <h2 className="mt-1 text-base font-medium tracking-[-0.02em] text-[#1c2430]">배경 소리</h2>
        </div>
        <p className="text-xs text-[#8a847c]">{ambient.playing ? `${active.label} 재생 중` : "타이머와 함께 재생"}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="배경 소리">
        {AMBIENT_TRACKS.map((track) => {
          const Icon = icons[track.id];
          const selected = ambient.track === track.id;
          return (
            <button
              key={track.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setAmbientTrack(track.id as AmbientTrackId)}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c2430]/20",
                selected
                  ? "border-transparent bg-[#1c2430] font-medium text-white"
                  : "border-black/[0.06] bg-white text-[#1c2430] hover:bg-black/[0.03]",
              )}
            >
              <Icon className="size-4" />
              {track.label}
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm text-[#6f6a64]">
        <Volume2 className="size-4 shrink-0 text-[#1c2430]" />
        <span className="sr-only">볼륨</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(ambient.volume * 100)}
          onChange={(event) => setAmbientVolume(Number(event.target.value) / 100)}
          aria-label="볼륨"
          className="h-1.5 w-full cursor-pointer accent-[#1c2430]"
        />
        <span className="w-10 text-right font-mono text-xs tabular-nums text-[#8a847c]">
          {Math.round(ambient.volume * 100)}
        </span>
      </label>
    </Surface>
  );
}
