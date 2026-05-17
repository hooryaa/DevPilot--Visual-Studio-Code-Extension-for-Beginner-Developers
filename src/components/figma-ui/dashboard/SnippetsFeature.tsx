/**
 * DevPilot Snippets Feature
 * Code snippet library - save, load, and manage code snippets
 */

import React, { useState } from "react";

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  createdAt: number;
}

export interface SnippetsFeatureProps {
  onInsertSnippet?: (code: string) => void;
}

const SAMPLE_SNIPPETS: CodeSnippet[] = [
  {
    id: "snippet-1",
    title: "Try-Catch Block",
    description: "Basic error handling template",
    code: `try {
  // Your code here
} catch (error) {
  console.error('Error:', error);
}`,
    language: "typescript",
    tags: ["error-handling", "async"],
    createdAt: Date.now(),
  },
  {
    id: "snippet-2",
    title: "Async Function",
    description: "Template for async function",
    code: `async function fetchData(url: string) {
  try {
    const response = await fetch(url);
    return response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}`,
    language: "typescript",
    tags: ["async", "fetch"],
    createdAt: Date.now(),
  },
  {
    id: "snippet-3",
    title: "Array Filter",
    description: "Filter and map array",
    code: `const filtered = items
  .filter(item => item.active)
  .map(item => item.value)`,
    language: "typescript",
    tags: ["array", "functional"],
    createdAt: Date.now(),
  },
];

export const SnippetsFeature: React.FC<SnippetsFeatureProps> = ({
  onInsertSnippet,
}) => {
  const [snippets, setSnippets] = useState<CodeSnippet[]>(SAMPLE_SNIPPETS);
  const [search, setSearch] = useState("");
  const [selectedSnippet, setSelectedSnippet] = useState<CodeSnippet | null>(
    null
  );

  const filteredSnippets = snippets.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.includes(search.toLowerCase()))
  );

  const handleInsert = (code: string) => {
    if (onInsertSnippet) {
      onInsertSnippet(code);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4">
        <h2 className="text-lg font-bold">📚 Code Snippets</h2>
        <p className="text-sm text-purple-100">Save and reuse code snippets</p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-300 bg-gray-50">
        <input
          type="text"
          placeholder="Search snippets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Snippets List & Detail */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-1/2 border-r border-gray-300 overflow-y-auto">
          {filteredSnippets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No snippets found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  onClick={() => setSelectedSnippet(snippet)}
                  className={`w-full text-left p-3 hover:bg-purple-50 transition ${
                    selectedSnippet?.id === snippet.id ? "bg-purple-50" : ""
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900">
                    {snippet.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {snippet.description}
                  </p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {snippet.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        {selectedSnippet ? (
          <div className="w-1/2 flex flex-col p-4 bg-gray-50">
            <h3 className="font-bold text-gray-900 mb-2">
              {selectedSnippet.title}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {selectedSnippet.description}
            </p>

            {/* Code Preview */}
            <pre className="flex-1 bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto font-mono mb-3">
              <code>{selectedSnippet.code}</code>
            </pre>

            {/* Insert Button */}
            <button
              onClick={() => handleInsert(selectedSnippet.code)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Insert Snippet
            </button>
          </div>
        ) : (
          <div className="w-1/2 flex items-center justify-center text-gray-500 bg-gray-50">
            <p className="text-sm">Select a snippet to view</p>
          </div>
        )}
      </div>
    </div>
  );
};
