'use client'

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  isCyan: boolean;
}

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const numStars = 200;
    starsRef.current = Array.from({ length: numStars }, () => ({
      x: Math.random() * canvas.width - canvas.width / 2,
      y: Math.random() * canvas.height - canvas.height / 2,
      z: Math.random() * 1000,
      size: Math.random() * 2,
      opacity: Math.random() * 0.8 + 0.2,
      isCyan: Math.random() > 0.5,
    }));

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      starsRef.current.forEach((star) => {
        star.z -= 2;
        if (star.z <= 0) {
          star.x = Math.random() * canvas.width - canvas.width / 2;
          star.y = Math.random() * canvas.height - canvas.height / 2;
          star.z = 1000;
        }

        const x = (star.x / star.z) * 500 + centerX;
        const y = (star.y / star.z) * 500 + centerY;
        const size = (1 - star.z / 1000) * star.size * 3;

        const color = star.isCyan
          ? `rgba(34, 211, 238, ${star.opacity})`
          : `rgba(192, 132, 252, ${star.opacity})`;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        if (star.z < 300) {
          const prevZ = star.z + 2;
          const px = (star.x / prevZ) * 500 + centerX;
          const py = (star.y / prevZ) * 500 + centerY;

          ctx.strokeStyle = star.isCyan
            ? `rgba(34, 211, 238, ${star.opacity * 0.5})`
            : `rgba(192, 132, 252, ${star.opacity * 0.5})`;
          ctx.lineWidth = size / 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}

