/**
 * DevPilot QuickFix Feature
 * Shows available quick fixes for current file
 */

import React, { useState } from "react";

export interface QuickFix {
  id: string;
  title: string;
  description: string;
  category: "performance" | "style" | "security" | "best-practice";
  before: string;
  after: string;
}

export interface QuickFixFeatureProps {
  onApplyFix?: (id: string) => void;
}

const SAMPLE_FIXES: QuickFix[] = [
  {
    id: "fix-1",
    title: "Use const instead of let",
    description: "Variable is never reassigned",
    category: "best-practice",
    before: "let x = 5;",
    after: "const x = 5;",
  },
  {
    id: "fix-2",
    title: "Add type annotation",
    description: "Improve type safety",
    category: "best-practice",
    before: "function greet(name) {",
    after: "function greet(name: string) {",
  },
  {
    id: "fix-3",
    title: "Use optional chaining",
    description: "Safely access nested properties",
    category: "style",
    before: "obj.prop.nested.value",
    after: "obj?.prop?.nested?.value",
  },
  {
    id: "fix-4",
    title: "Add null check",
    description: "Prevent null reference errors",
    category: "security",
    before: "data.trim()",
    after: "data?.trim() ?? ''",
  },
];

export const QuickFixFeature: React.FC<QuickFixFeatureProps> = ({
  onApplyFix,
}) => {
  const [fixes] = useState<QuickFix[]>(SAMPLE_FIXES);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    "all",
    ...new Set(fixes.map((f) => f.category)),
  ] as const;

  const filteredFixes =
    selectedCategory === "all" || !selectedCategory
      ? fixes
      : fixes.filter((f) => f.category === selectedCategory);

  const handleApply = (fix: QuickFix) => {
    setApplied((prev) => new Set([...prev, fix.id]));
    if (onApplyFix) {
      onApplyFix(fix.id);
    }
    // Mark as applied for 2 seconds
    setTimeout(() => {
      setApplied((prev) => {
        const next = new Set(prev);
        next.delete(fix.id);
        return next;
      });
    }, 2000);
  };

  const categoryColors: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    performance: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
    },
    style: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    },
    security: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
    "best-practice": {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    },
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4">
        <h2 className="text-lg font-bold">⚡ Quick Fixes</h2>
        <p className="text-sm text-indigo-100">
          Available improvements for your code
        </p>
      </div>

      {/* Category Filter */}
      <div className="p-4 border-b border-gray-300 bg-gray-50 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setSelectedCategory(cat === "all" ? null : (cat as any))
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                (cat === "all" && !selectedCategory) ||
                selectedCategory === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {cat.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Fixes List */}
      <div className="flex-1 overflow-y-auto">
        {filteredFixes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-sm">No fixes in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredFixes.map((fix) => {
              const colors = categoryColors[fix.category];
              const isApplied = applied.has(fix.id);

              return (
                <div
                  key={fix.id}
                  className={`p-4 transition ${colors.bg} border-l-4 ${colors.border}`}
                >
                  {/* Title and Category */}
                  <div className="flex items-start justify-between mb-2">
                    <h4 className={`font-medium text-sm ${colors.text}`}>
                      {fix.title}
                    </h4>
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${colors.text} bg-white border ${colors.border}`}
                    >
                      {fix.category}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 mb-3">
                    {fix.description}
                  </p>

                  {/* Code Comparison */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Before</p>
                      <pre className="bg-red-100 text-red-900 p-2 rounded text-xs overflow-auto font-mono">
                        {fix.before}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">After</p>
                      <pre className="bg-green-100 text-green-900 p-2 rounded text-xs overflow-auto font-mono">
                        {fix.after}
                      </pre>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <button
                    onClick={() => handleApply(fix)}
                    disabled={isApplied}
                    className={`w-full px-3 py-2 rounded text-xs font-medium transition ${
                      isApplied
                        ? "bg-green-600 text-white"
                        : `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-75`
                    }`}
                  >
                    {isApplied ? "✓ Applied" : "Apply Fix"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
