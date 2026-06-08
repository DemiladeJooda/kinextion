"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

const COLORS = ["#00C47A", "#0ABAB5", "#A855F7"];

interface Star {
  id: number;
  startX: number;
  startY: number;
  angle: number;
  color: string;
  length: number;
  duration: number;
}

function StarElement({
  star,
  onDone,
}: {
  readonly star: Star;
  readonly onDone: (id: number) => void;
}) {
  const rad = (star.angle * Math.PI) / 180;
  const dx = Math.cos(rad) * 280;
  const dy = Math.sin(rad) * 280;

  return (
    <motion.div
      style={{
        position: "fixed",
        top: `${star.startY}vh`,
        left: `${star.startX}vw`,
        pointerEvents: "none",
        zIndex: 9,
      }}
      initial={{ x: 0, y: 0, opacity: 0 }}
      animate={{ x: dx, y: dy, opacity: [0, 1, 1, 0] }}
      transition={{ duration: star.duration, ease: "easeOut" }}
      onAnimationComplete={() => onDone(star.id)}
    >
      <div
        style={{
          width: `${star.length}px`,
          height: "3px",
          background: `linear-gradient(90deg, transparent 0%, ${star.color}70 25%, ${star.color} 75%, rgba(255,255,255,0.95) 100%)`,
          transform: `rotate(${star.angle}deg)`,
          transformOrigin: "left center",
          boxShadow: `0 0 8px 2px ${star.color}70, 0 0 20px ${star.color}35`,
          borderRadius: "0 3px 3px 0",
          filter: "brightness(1.1)",
        }}
      />
    </motion.div>
  );
}

export function ShootingStars({ active }: { readonly active: boolean }) {
  const [stars, setStars] = useState<Star[]>([]);
  const idRef = useRef(0);

  const removeStar = useCallback((id: number) => {
    setStars(prev => prev.filter(s => s.id !== id));
  }, []);

  useEffect(() => {
    if (!active) {
      setStars([]);
      return;
    }

    let cancelled = false;

    const spawn = () => {
      if (cancelled) return;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      setStars(prev => [
        ...prev,
        {
          id: idRef.current++,
          startX: 5 + Math.random() * 75,
          startY: 3 + Math.random() * 28,
          angle: 26 + Math.random() * 20,
          color,
          length: 160 + Math.random() * 180,
          duration: 0.75 + Math.random() * 0.6,
        },
      ]);
    };

    const loop = async () => {
      await new Promise<void>(r => setTimeout(r, 700 + Math.random() * 1400));
      while (!cancelled) {
        spawn();
        await new Promise<void>(r => setTimeout(r, 3500 + Math.random() * 6000));
      }
    };

    void loop();
    return () => { cancelled = true; };
  }, [active]);

  return (
    <>
      {stars.map(star => (
        <StarElement key={star.id} star={star} onDone={removeStar} />
      ))}
    </>
  );
}
