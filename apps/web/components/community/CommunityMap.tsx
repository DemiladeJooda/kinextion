"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { KIND_COLOR, MAP_PLACES, type MapPlace } from "@/lib/community-places";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const CENTER: [number, number] = [-96.795, 32.803];

/** Dallas is the first city. The map opens on real groups, nothing invented. */
export function CommunityMap() {
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<MapPlace | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap | null = null;
    let cancelled = false;

    void import("maplibre-gl")
      .then(({ Map: MapLibre, Marker, NavigationControl, setWorkerUrl }) => {
        if (cancelled || !container.current) return;

        // Webpack can't bundle the library's module worker, so it's served from
        // public/maplibre. Re-copy from dist when upgrading maplibre-gl.
        setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        const active = new MapLibre({
          container: container.current,
          style: STYLE_URL,
          center: CENTER,
          zoom: 9.6,
          pitch: 0,
          attributionControl: { compact: true },
          // The page has to keep scrolling when the cursor is over the map.
          scrollZoom: false,
          dragRotate: false,
        });

        map = active;
        active.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
        active.on("error", (e) => {
          if (!active.loaded() && /style|Failed to fetch/i.test(String(e.error?.message))) setFailed(true);
        });

        active.on("load", () => {
          active.flyTo({ center: CENTER, zoom: 11.6, pitch: 38, duration: 2600, essential: true });

          MAP_PLACES.forEach((place, i) => {
            const color = KIND_COLOR[place.kind];
            const el = document.createElement("button");
            el.type = "button";
            el.className = "kx-pin";
            el.setAttribute("aria-label", `${place.name}, ${place.kind}`);
            el.style.setProperty("--pin", color);
            el.style.animationDelay = `${0.5 + i * 0.09}s`;
            el.addEventListener("click", () => {
              setSelected(place);
              active.flyTo({ center: [place.lng, place.lat], zoom: 13.2, pitch: 45, duration: 1100 });
            });
            new Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(active);
          });
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <div className="relative overflow-hidden" style={{ height: "calc(100vh - var(--nav-height, 56px))", minHeight: 520 }}>
      {/* Maplibre sets position: relative on its container, so the sizing lives on a wrapper. */}
      <div className="absolute inset-0" style={{ background: "#0B1120" }}>
        <div ref={container} style={{ width: "100%", height: "100%" }} />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{ background: "linear-gradient(to bottom, #05081A 8%, rgba(5,8,26,0.7) 55%, transparent)" }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 pt-8 sm:pt-10 px-6 text-center">
        <p className="section-label" style={{ color: "#0ABAB5", WebkitTextFillColor: "#0ABAB5", marginBottom: "0.5rem" }}>
          Community
        </p>
        <h2 className="font-semibold text-white text-balance" style={{ fontSize: "clamp(2rem, 4.6vw, 3.6rem)" }}>
          No one reaches <span className="text-white/45">their best alone.</span>
        </h2>
        <p className="mt-2 text-[15px] text-white/75">{failed ? "The map didn't load." : "Tap a pin. These are real, and they're near you in Dallas."}</p>
      </div>

      <div className="absolute right-3 sm:right-14 bottom-28 sm:bottom-8 w-[50%] sm:w-64 rounded-2xl p-3 sm:p-4" style={{ background: "rgba(10,15,27,0.88)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
        <p className="text-white text-[13px] sm:text-sm font-semibold leading-tight">Run a group in Dallas?</p>
        <a href="mailto:hello@kinextion.com?subject=Dallas%20community" className="mt-1 inline-flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold" style={{ color: "#0ABAB5" }}>
          Tell us about it <ArrowUpRight size={14} />
        </a>
        <p className="hidden sm:block mt-2 text-[10.5px] leading-snug text-white/45">
          Groups here are independent, not partners or sponsors. Each pin links to its own page.
        </p>
      </div>

      <div className="pointer-events-none absolute left-4 bottom-8 flex flex-wrap gap-x-3 gap-y-1 max-w-[48%] sm:max-w-[60%]">
        {(Object.keys(KIND_COLOR) as (keyof typeof KIND_COLOR)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-white/80">
            <span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
            {k}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            key={selected.id}
            className="absolute left-1/2 -translate-x-1/2 bottom-16 w-[min(92vw,380px)] rounded-3xl p-5"
            style={{ background: "rgba(10,15,27,0.94)", border: `1px solid ${KIND_COLOR[selected.kind]}66` }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          >
            <button onClick={() => setSelected(null)} aria-label="Close" className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-white/60 hover:text-white cursor-pointer">
              <X size={17} />
            </button>
            <p className="text-xs font-semibold" style={{ color: KIND_COLOR[selected.kind] }}>
              {selected.kind}
            </p>
            <h3 className="mt-0.5 text-white font-semibold text-xl pr-8">{selected.name}</h3>
            <p className="mt-1 text-sm text-white/70">{selected.note}</p>
            <a href={selected.href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">
              Their page <ArrowUpRight size={15} />
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: "linear-gradient(to top, #05081A, transparent)" }} />
    </div>
  );
}
