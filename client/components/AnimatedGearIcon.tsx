import React from "react";
import { Cog } from "lucide-react";
import { cn } from "@/lib/utils";
import "./styles/animated-gear.css";

interface AnimatedGearIconProps {
  className?: string;
  size?: number;
  initials?: string;
  backgroundColor?: string;
}

export const AnimatedGearIcon: React.FC<AnimatedGearIconProps> = ({
  className,
  size = 40,
  initials = "U",
  backgroundColor = "bg-gray-600",
}) => {
  const gearCount = 8;
  const radius = size * 0.55;
  const gearSize = size * 0.3;

  // Extract color from Tailwind className (e.g., "bg-green-600" -> "rgb(22, 163, 74)")
  const colorMap: { [key: string]: string } = {
    "bg-green-600": "rgb(22, 163, 74)",
    "bg-red-600": "rgb(220, 38, 38)",
    "bg-blue-600": "rgb(37, 99, 235)",
    "bg-gray-600": "rgb(75, 85, 99)",
  };
  const bgColorRgb = colorMap[backgroundColor] || "rgb(75, 85, 99)";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center animated-gear-container", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Center avatar circle */}
      <div
        className="absolute rounded-full flex items-center justify-center text-white font-bold z-10"
        style={{
          width: `${size / 2}px`,
          height: `${size / 2}px`,
          backgroundColor: bgColorRgb,
          fontSize: `${size * 0.2}px`,
          lineHeight: "1",
        }}
      >
        {initials}
      </div>

      {/* Orbiting gears container */}
      <div
        className="absolute animate-spin-slow"
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {/* Create gears positioned around the circle */}
        {Array.from({ length: gearCount }).map((_, i) => {
          const angle = (i * 360) / gearCount;
          const radian = (angle * Math.PI) / 180;
          const x = Math.cos(radian) * radius;
          const y = Math.sin(radian) * radius;

          return (
            <div
              key={i}
              className="absolute opacity-70 transition-opacity hover:opacity-100"
              style={{
                left: `${size / 2}px`,
                top: `${size / 2}px`,
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                width: `${gearSize}px`,
                height: `${gearSize}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Cog
                size={gearSize}
                className="text-gray-400"
                strokeWidth={1.5}
                style={{ animation: "spin 8s linear infinite reverse" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnimatedGearIcon;
