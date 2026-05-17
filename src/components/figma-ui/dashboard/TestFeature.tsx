/**
 * DevPilot Test Feature
 * Test runner interface showing test results
 */

import React, { useState, useEffect } from "react";

export interface TestResult {
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  error?: string;
}

export interface TestFeatureProps {
  onRunTests?: () => Promise<TestResult[]>;
}

export const TestFeature: React.FC<TestFeatureProps> = ({ onRunTests }) => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  });

  // Mock test data for demo
  const mockTests: TestResult[] = [
    {
      id: "test-1",
      name: "should parse valid code",
      status: "pass",
      duration: 45,
    },
    {
      id: "test-2",
      name: "should handle error cases",
      status: "pass",
      duration: 67,
    },
    {
      id: "test-3",
      name: "should validate types",
      status: "fail",
      duration: 89,
      error: "Expected string but got number",
    },
    {
      id: "test-4",
      name: "should support edge cases",
      status: "skip",
      duration: 0,
    },
    {
      id: "test-5",
      name: "should optimize performance",
      status: "pass",
      duration: 123,
    },
  ];

  const runTests = async () => {
    setIsRunning(true);
    try {
      // Simulate test run with delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Use provided tests or mock
      const results = onRunTests ? await onRunTests() : mockTests;

      setTests(results);

      // Calculate stats
      const stats = {
        passed: results.filter((t) => t.status === "pass").length,
        failed: results.filter((t) => t.status === "fail").length,
        skipped: results.filter((t) => t.status === "skip").length,
        total: results.length,
      };
      setStats(stats);
    } catch (error) {
      console.error("Failed to run tests:", error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    // Auto-run tests on mount
    runTests();
  }, []);

  const passRate =
    stats.total > 0
      ? Math.round((stats.passed / (stats.total - stats.skipped)) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
        <h2 className="text-lg font-bold">🧪 Test Runner</h2>
        <p className="text-sm text-green-100">View and run tests</p>
      </div>

      {/* Stats */}
      <div className="bg-gray-100 p-4 border-b border-gray-300">
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
            <p className="text-xs text-gray-600">Passed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-600">Failed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {stats.skipped}
            </p>
            <p className="text-xs text-gray-600">Skipped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{passRate}%</p>
            <p className="text-xs text-gray-600">Pass Rate</p>
          </div>
        </div>

        {/* Progress Bar */}
        {stats.total > 0 && (
          <div className="mt-3 w-full bg-gray-300 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${passRate}%` }}
            ></div>
          </div>
        )}
      </div>

      {/* Tests List */}
      <div className="flex-1 overflow-y-auto">
        {tests.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No tests yet. Click Run to execute tests.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tests.map((test) => (
              <div
                key={test.id}
                className="p-3 hover:bg-gray-50 transition flex items-start gap-3"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0 pt-0.5">
                  {test.status === "pass" && (
                    <span className="text-green-600 font-bold">✓</span>
                  )}
                  {test.status === "fail" && (
                    <span className="text-red-600 font-bold">✗</span>
                  )}
                  {test.status === "skip" && (
                    <span className="text-yellow-600 font-bold">-</span>
                  )}
                </div>

                {/* Test Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {test.name}
                  </p>
                  {test.error && (
                    <p className="text-xs text-red-600 mt-1">{test.error}</p>
                  )}
                </div>

                {/* Duration */}
                {test.duration > 0 && (
                  <div className="flex-shrink-0 text-xs text-gray-500">
                    {test.duration}ms
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run Button */}
      <div className="border-t border-gray-300 p-4 bg-white">
        <button
          onClick={runTests}
          disabled={isRunning}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          {isRunning ? "Running Tests..." : "Run Tests"}
        </button>
      </div>
    </div>
  );
};
