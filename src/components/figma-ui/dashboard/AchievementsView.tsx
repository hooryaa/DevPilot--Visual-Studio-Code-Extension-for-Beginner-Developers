/**
 * DevPilot Achievements View
 * Displays achievement gallery with progress tracking
 */

import React, { useState } from "react";
import { AchievementBadge } from "../AchievementBadge";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number; // 0-1 for locked achievements
  unlockedAt?: number;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_hour",
    title: "First Hour",
    description: "Complete 60 minutes of learning",
    icon: "⏱️",
    unlocked: true,
    unlockedAt: Date.now() - 86400000,
  },
  {
    id: "5_hours",
    title: "Five Hours",
    description: "Complete 300 minutes of learning",
    icon: "🕐",
    unlocked: true,
    unlockedAt: Date.now() - 43200000,
  },
  {
    id: "1000_minutes",
    title: "Dedicated Learner",
    description: "Complete 1000 minutes of learning",
    icon: "🏆",
    unlocked: false,
    progress: 0.65,
  },
  {
    id: "week_streak",
    title: "Week Streak",
    description: "Maintain a 7-day learning streak",
    icon: "🔥",
    unlocked: false,
    progress: 0.43,
  },
  {
    id: "month_streak",
    title: "Month Streak",
    description: "Maintain a 30-day learning streak",
    icon: "🌟",
    unlocked: false,
    progress: 0.13,
  },
  {
    id: "5_lessons",
    title: "Course Starter",
    description: "Complete 5 lessons",
    icon: "📚",
    unlocked: true,
    unlockedAt: Date.now() - 172800000,
  },
  {
    id: "20_lessons",
    title: "Course Master",
    description: "Complete 20 lessons",
    icon: "👨‍🎓",
    unlocked: false,
    progress: 0.25,
  },
  {
    id: "10_problems",
    title: "Problem Solver",
    description: "Solve 10 practice problems",
    icon: "🎯",
    unlocked: false,
    progress: 0.70,
  },
  {
    id: "high_scorer",
    title: "High Scorer",
    description: "Achieve 90% average on problems",
    icon: "⭐",
    unlocked: false,
    progress: 0.88,
  },
];

export interface AchievementsViewProps {
  achievements?: Achievement[];
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  achievements = ACHIEVEMENTS,
}) => {
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  const filtered =
    filter === "all"
      ? achievements
      : filter === "unlocked"
        ? achievements.filter((a) => a.unlocked)
        : achievements.filter((a) => !a.unlocked);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600 to-amber-600 text-white p-4">
        <h2 className="text-lg font-bold">🏆 Achievements</h2>
        <p className="text-sm text-yellow-100">
          {unlockedCount} of {totalCount} unlocked
        </p>
      </div>

      {/* Stats */}
      <div className="bg-yellow-50 p-4 border-b border-yellow-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-yellow-700">{unlockedCount}</p>
            <p className="text-xs text-gray-600">Achievements Unlocked</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-700">
              {Math.round((unlockedCount / totalCount) * 100)}%
            </p>
            <p className="text-xs text-gray-600">Completion</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-yellow-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-yellow-600 to-amber-600 h-3 rounded-full transition-all"
            style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        {(["all", "unlocked", "locked"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              filter === f
                ? "border-b-2 border-yellow-600 text-yellow-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "unlocked"
                ? "Unlocked"
                : "Locked"}
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-sm">No achievements in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                icon={achievement.icon}
                title={achievement.title}
                description={achievement.description}
                unlocked={achievement.unlocked}
                progress={achievement.progress}
              />
            ))}
          </div>
        )}
      </div>

      {/* Next Achievement Info */}
      {unlockedCount < totalCount && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <p className="text-xs text-gray-600 mb-2">Next milestone:</p>
          {(() => {
            const nextLocked = filtered.find((a) => !a.unlocked);
            if (nextLocked) {
              return (
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {nextLocked.icon} {nextLocked.title}
                  </p>
                  <div className="w-full bg-gray-300 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-yellow-600 h-1.5 rounded-full"
                      style={{ width: `${(nextLocked.progress || 0) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {Math.round((nextLocked.progress || 0) * 100)}% complete
                  </p>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
};
