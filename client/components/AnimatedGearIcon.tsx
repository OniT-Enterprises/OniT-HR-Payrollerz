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
  const gearCount = 8;
  const radius = size * 0.55;
  const bgColor = backgroundColor.replace("bg-", "");

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Center avatar circle */}
      <div
        className={`absolute inset-0 rounded-full ${backgroundColor} flex items-center justify-center text-white font-bold`}
        style={{
          width: `${size / 2.2}px`,
          height: `${size / 2.2}px`,
          fontSize: `${size * 0.25}px`,
        }}
      >
        {initials}
      </div>

      {/* Orbiting gears */}
      {Array.from({ length: gearCount }).map((_, i) => {
        const angle = (i * 360) / gearCount;
        const radian = (angle * Math.PI) / 180;
        const x = Math.cos(radian) * radius;
        const y = Math.sin(radian) * radius;

        return (
          <div
            key={i}
            className="absolute animate-spin-slow"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%)`,
              width: `${size}px`,
              height: `${size}px`,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${radius + size / 2}px`,
                top: `${size / 2}px`,
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                opacity: 0.7,
              }}
            >
              <Cog
                size={size * 0.3}
                className="text-gray-400"
                strokeWidth={1.5}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AnimatedGearIcon;
