import React from "react";
import { Cog } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const gearSize = size * 0.3;
  const radius = size * 0.55;

  // Create 8 gears around the circumference
  const gears = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i * 360) / 8;
    const radian = (angle * Math.PI) / 180;
    const x = Math.cos(radian) * radius;
    const y = Math.sin(radian) * radius;
    const rotation = angle;

    return (
      <g key={i} transform={`translate(${x}, ${y}) rotate(${rotation})`}>
        <Cog
          size={gearSize}
          className="text-gray-400 opacity-70 animate-spin-slow"
          strokeWidth={1.5}
        />
      </g>
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      className={cn("", className)}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
    >
      {/* Center circle (avatar) */}
      <circle
        cx="0"
        cy="0"
        r={size / 2.5}
        className={backgroundColor}
        fill="currentColor"
      />

      {/* Avatar text */}
      <text
        x="0"
        y="0"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-white text-sm font-bold"
        fill="white"
        fontSize={size * 0.3}
      >
        {initials}
      </text>

      {/* Orbiting gears */}
      {gears}
    </svg>
  );
};

export default AnimatedGearIcon;
