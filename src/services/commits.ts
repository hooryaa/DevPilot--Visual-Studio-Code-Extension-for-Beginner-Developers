/**
 * DevPilot Native Commit Generator
 * Deterministic commit message generation based on file changes
 * Works completely offline - no LLM needed
 */

export interface DiffAnalysis {
  filesAdded: string[];
  filesDeleted: string[];
  filesModified: string[];
  filesRenamed: Array<{ from: string; to: string }>;
  totalLines: number;
  addedLines: number;
  deletedLines: number;
  keywords: Set<string>;
}

/**
 * Parse a git diff and extract analysis
 */
export function analyzeDiff(diff: string): DiffAnalysis {
  const lines = diff.split("\n");
  const analysis: DiffAnalysis = {
    filesAdded: [],
    filesDeleted: [],
    filesModified: [],
    filesRenamed: [],
    totalLines: lines.length,
    addedLines: 0,
    deletedLines: 0,
    keywords: new Set(),
  };

  let currentFile = "";

  for (const line of lines) {
    // File markers
    if (line.startsWith("diff --git a/")) {
      const match = line.match(/a\/(.*?)\s+b\/(.*?)$/);
      if (match) {
        currentFile = match[2];
      }
    }

    // New file
    if (line.startsWith("new file")) {
      if (currentFile) {
        analysis.filesAdded.push(currentFile);
        extractKeywords(currentFile, analysis.keywords);
      }
    }

    // Deleted file
    if (line.startsWith("deleted file")) {
      if (currentFile) {
        analysis.filesDeleted.push(currentFile);
        extractKeywords(currentFile, analysis.keywords);
      }
    }

    // Renamed file
    if (line.startsWith("rename from")) {
      const renameFrom = line.replace("rename from ", "").trim();
      const renameTo = lines
        .find((l) => l.startsWith("rename to "))
        ?.replace("rename to ", "")
        .trim();
      if (renameTo) {
        analysis.filesRenamed.push({ from: renameFrom, to: renameTo });
        extractKeywords(renameFrom, analysis.keywords);
        extractKeywords(renameTo, analysis.keywords);
      }
    }

    // Count changes
    if (line.startsWith("+") && !line.startsWith("+++")) {
      analysis.addedLines++;
      extractKeywords(line, analysis.keywords);
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      analysis.deletedLines++;
    }

    // Modified file (if we have + or - but no new/deleted marker)
    if (
      (line.startsWith("+") || line.startsWith("-")) &&
      !line.startsWith("+++") &&
      !line.startsWith("---") &&
      currentFile &&
      !analysis.filesAdded.includes(currentFile) &&
      !analysis.filesDeleted.includes(currentFile) &&
      !analysis.filesModified.includes(currentFile)
    ) {
      analysis.filesModified.push(currentFile);
    }
  }

  return analysis;
}

/**
 * Extract keywords from text for semantic analysis
 */
function extractKeywords(text: string, keywords: Set<string>): void {
  const keywordPatterns = [
    /fix|bug|error|issue|crash/gi,
    /add|new|feature|implement/gi,
    /refactor|improve|optimize|clean/gi,
    /test|spec|coverage/gi,
    /doc|readme|comment|docs/gi,
    /style|format|lint|prettier/gi,
    /type|types|typescript|ts/gi,
    /import|export|module/gi,
    /config|configuration|setup/gi,
    /build|compile|bundle|webpack|rollup|esbuild/gi,
    /hover|inline|completion|provider/gi,
    /git|commit|branch|merge/gi,
    /api|endpoint|server|client/gi,
    /database|db|query|sql/gi,
    /ui|component|react|html/gi,
    /performance|perf|speed|memory/gi,
    /security|auth|password|token/gi,
    /dependencies|deps|package|npm/gi,
  ];

  for (const pattern of keywordPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => keywords.add(m.toLowerCase()));
    }
  }
}

/**
 * Determine commit type based on analysis
 */
export function determineCommitType(analysis: DiffAnalysis): string {
  const keywords = Array.from(analysis.keywords);
  const keywordsLower = keywords.map((k) => k.toLowerCase());

  // Check for specific patterns
  if (
    keywordsLower.some((k) =>
      ["fix", "bug", "error", "issue", "crash"].some((p) => k.includes(p))
    )
  ) {
    return "fix";
  }

  if (
    keywordsLower.some((k) =>
      ["test", "spec", "coverage"].some((p) => k.includes(p))
    )
  ) {
    return "test";
  }

  if (
    keywordsLower.some((k) =>
      ["doc", "readme", "comment"].some((p) => k.includes(p))
    )
  ) {
    return "docs";
  }

  if (
    keywordsLower.some((k) =>
      ["style", "format", "lint"].some((p) => k.includes(p))
    )
  ) {
    return "style";
  }

  if (
    keywordsLower.some((k) =>
      ["refactor", "improve", "optimize"].some((p) => k.includes(p))
    )
  ) {
    return "refactor";
  }

  if (
    keywordsLower.some((k) =>
      [
        "build",
        "compile",
        "bundle",
        "webpack",
        "dependencies",
        "config",
      ].some((p) => k.includes(p))
    )
  ) {
    return "build";
  }

  // If significant additions, it's likely a feature
  if (analysis.addedLines > analysis.deletedLines * 2) {
    return "feat";
  }

  // Default
  return "chore";
}

/**
 * Generate commit subject based on analysis
 */
function generateCommitSubject(analysis: DiffAnalysis): string {
  const type = determineCommitType(analysis);

  // File-based subject
  if (analysis.filesAdded.length === 1 && analysis.filesModified.length === 0) {
    return `${type}: add ${getFileDisplayName(analysis.filesAdded[0])}`;
  }

  if (
    analysis.filesDeleted.length === 1 &&
    analysis.filesModified.length === 0
  ) {
    return `${type}: remove ${getFileDisplayName(analysis.filesDeleted[0])}`;
  }

  if (
    analysis.filesRenamed.length === 1 &&
    analysis.filesModified.length === 0
  ) {
    return `${type}: rename ${getFileDisplayName(analysis.filesRenamed[0].from)} to ${getFileDisplayName(analysis.filesRenamed[0].to)}`;
  }

  // Keyword-based subject
  const keywords = Array.from(analysis.keywords);
  if (keywords.length > 0) {
    const primaryKeyword = keywords[0];
    const fileCount =
      analysis.filesModified.length +
      analysis.filesAdded.length +
      analysis.filesDeleted.length;

    if (fileCount === 1) {
      const fileName = analysis.filesModified[0] || analysis.filesAdded[0];
      return `${type}: ${primaryKeyword} ${getFileDisplayName(fileName)}`;
    }

    return `${type}: ${primaryKeyword} (${fileCount} files)`;
  }

  // Fallback: generic with file count
  const totalFiles =
    analysis.filesAdded.length +
    analysis.filesModified.length +
    analysis.filesDeleted.length;
  return `${type}: update ${totalFiles} file${totalFiles !== 1 ? "s" : ""}`;
}

/**
 * Generate full commit message with body
 */
export function generateCommitMessage(diff: string): string {
  const analysis = analyzeDiff(diff);

  // Generate subject (first line)
  const subject = generateCommitSubject(analysis);

  // Generate body (details)
  const bodyLines: string[] = [];

  if (analysis.filesAdded.length > 0) {
    bodyLines.push(
      `Added: ${analysis.filesAdded.map(getFileDisplayName).join(", ")}`
    );
  }

  if (analysis.filesDeleted.length > 0) {
    bodyLines.push(
      `Removed: ${analysis.filesDeleted.map(getFileDisplayName).join(", ")}`
    );
  }

  if (analysis.filesModified.length > 0) {
    const modifiedList = analysis.filesModified
      .slice(0, 3)
      .map(getFileDisplayName)
      .join(", ");
    const remaining =
      analysis.filesModified.length > 3
        ? ` +${analysis.filesModified.length - 3} more`
        : "";
    bodyLines.push(`Modified: ${modifiedList}${remaining}`);
  }

  if (analysis.filesRenamed.length > 0) {
    bodyLines.push(
      `Renamed: ${analysis.filesRenamed.map((r) => `${getFileDisplayName(r.from)} → ${getFileDisplayName(r.to)}`).join(", ")}`
    );
  }

  if (analysis.addedLines > 0 || analysis.deletedLines > 0) {
    bodyLines.push(`\nChanges: +${analysis.addedLines}/-${analysis.deletedLines}`);
  }

  // Combine subject and body
  if (bodyLines.length > 0) {
    return `${subject}\n\n${bodyLines.join("\n")}`;
  }

  return subject;
}

/**
 * Get display name for file path
 */
function getFileDisplayName(filePath: string): string {
  // Remove path, keep filename only
  const fileName = filePath.split("/").pop() || filePath;

  // Remove extension for certain file types
  if (fileName.endsWith(".ts")) {return fileName.replace(".ts", "");}
  if (fileName.endsWith(".tsx")) {return fileName.replace(".tsx", "");}
  if (fileName.endsWith(".js")) {return fileName.replace(".js", "");}
  if (fileName.endsWith(".jsx")) {return fileName.replace(".jsx", "");}
  if (fileName.endsWith(".json")) {return fileName.replace(".json", "");}

  return fileName;
}

/**
 * Quick commit message generator for simple cases
 * Returns just the subject line
 */
export function generateQuickCommitMessage(diff: string): string {
  const analysis = analyzeDiff(diff);
  return generateCommitSubject(analysis);
}

/**
 * Get commit suggestions (multiple options)
 */
export function getCommitSuggestions(diff: string): string[] {
  const analysis = analyzeDiff(diff);
  const suggestions: string[] = [];

  // Suggestion 1: Based on primary keyword
  suggestions.push(generateCommitSubject(analysis));

  // Suggestion 2: Based on file count
  const totalFiles =
    analysis.filesAdded.length +
    analysis.filesModified.length +
    analysis.filesDeleted.length;
  suggestions.push(
    `chore: update ${totalFiles} file${totalFiles !== 1 ? "s" : ""}`
  );

  // Suggestion 3: Based on lines changed
  const type =
    analysis.addedLines > analysis.deletedLines ? "feat" : "refactor";
  suggestions.push(
    `${type}: update code (+${analysis.addedLines}/-${analysis.deletedLines})`
  );

  return [...new Set(suggestions)]; // Remove duplicates
}
