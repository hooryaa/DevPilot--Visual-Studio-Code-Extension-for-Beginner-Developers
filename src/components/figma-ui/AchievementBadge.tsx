/**
 * DevPilot Achievement Badge Component
 * Displays individual achievement badges
 */

import React from "react";

export interface AchievementBadgeProps {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: number; // 0-1
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  icon,
  title,
  description,
  unlocked,
  progress,
}) => {
  return (
    <div
      className={`relative p-4 rounded-lg border-2 transition ${
        unlocked
          ? "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300 shadow-md"
          : "bg-gray-50 border-gray-300 opacity-60"
      }`}
    >
      {/* Lock Indicator */}
      {!unlocked && (
        <div className="absolute top-2 right-2 text-lg">🔒</div>
      )}

      {/* Icon */}
      <div className="text-4xl mb-2">{icon}</div>

      {/* Title */}
      <h3 className="font-bold text-sm text-gray-900">{title}</h3>

      {/* Description */}
      <p className="text-xs text-gray-600 mt-1">{description}</p>

      {/* Progress Bar (if applicable) */}
      {progress !== undefined && !unlocked && (
        <div className="mt-3 w-full bg-gray-300 rounded-full h-2">
          <div
            className="bg-yellow-400 h-2 rounded-full transition-all"
            style={{ width: `${progress * 100}%` }}
          ></div>
        </div>
      )}

      {/* Unlock Date (if unlocked) */}
      {unlocked && (
        <p className="text-xs text-yellow-700 mt-2">✓ Unlocked</p>
      )}
    </div>
  );
};
