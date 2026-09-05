"use client";

import { useEffect, useRef, useState } from "react";

const MUTED_STORAGE_KEY = "wc:muted";

function readStoredMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore — some privacy modes throw on localStorage access.
  }
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
      <path
        d="M4 9v6h4l5 4V5L8 9H4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Background music toggle + `<audio>` element.
 *
 * Renders nothing at all when `src` is null (no bundled preset, no active
 * uploaded track) — no player, no floating button.
 *
 * Playback only ever starts in response to `play` flipping true, which the
 * parent sets from the envelope's `onOpen` callback — never on mount, since
 * autoplaying audio is both blocked by browsers and an unwelcome surprise
 * for a guest who might be somewhere quiet.
 */
export function MusicPlayer({ src, play }: { src: string | null; play: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    setMuted(readStoredMuted());
  }, []);

  useEffect(() => {
    if (!src || !play || hasStartedRef.current) return;
    hasStartedRef.current = true;

    if (muted) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.play().catch(() => {
      // Autoplay was blocked, or some other playback error — fall back to
      // showing the toggle in the "off" state rather than throwing.
      setMuted(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, play]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (muted) {
      setMuted(false);
      writeStoredMuted(false);
      audio.play().catch(() => {
        setMuted(true);
        writeStoredMuted(true);
      });
    } else {
      setMuted(true);
      writeStoredMuted(true);
      audio.pause();
    }
  }

  if (!src) return null;

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Hidupkan muzik" : "Matikan muzik"}
        aria-pressed={!muted}
        className="fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-goldenrod/60 bg-sand/90 text-brown-deep shadow-md backdrop-blur"
        style={{ top: "calc(1rem + env(safe-area-inset-top))" }}
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
      </button>
    </>
  );
}
