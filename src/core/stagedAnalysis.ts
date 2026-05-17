/**
 * DevPilot Staged Change Analysis
 * 
 * Analyzes only git staged changes (git diff --staged)
 * Deterministic and reproducible analysis
 * Excludes unstaged changes and untracked files
 */

import simpleGit, { SimpleGit } from "simple-git";
import { getLogger } from "./logger";

const logger = getLogger("StagedChangeAnalysis");

export interface FileChange {
  fileName: string;
  status: "A" | "M" | "D" | "R" | "C" | "U"; // Added, Modified, Deleted, Renamed, Copied, Unmerged
  additions: number;
  deletions: number;
  diff: string;
}

export interface StagedAnalysis {
  timestamp: number;
  filesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  files: FileChange[];
  summary: string;
  languages: Record<string, number>;
}

/**
 * Staged Change Analyzer
 */
export class StagedChangeAnalyzer {
  private git: SimpleGit | null = null;
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.git = simpleGit(workspacePath);
  }

  /**
   * Analyze staged changes only (git diff --staged)
   * Returns deterministic results based on staged content only
   */
  async analyzeStagedChanges(): Promise<StagedAnalysis> {
    if (!this.git) {
      throw new Error("[DevPilot] Git not initialized");
    }

    try {
      // Get staged diff (--cached flag)
      const stagedDiff = await this.git.diff(["--cached"]);

      if (!stagedDiff || stagedDiff.trim() === "") {
        logger.info("[DevPilot] No staged changes found");
        return {
          timestamp: Date.now(),
          filesChanged: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          files: [],
          summary: "No staged changes",
          languages: {},
        };
      }

      // Get status of staged changes
      const statusOutput = await this.git.raw(["diff", "--cached", "--name-status"]);
      const files = this.parseFileChanges(statusOutput, stagedDiff);

      // Calculate statistics
      const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
      const languages = this.detectLanguages(files);

      const analysis: StagedAnalysis = {
        timestamp: Date.now(),
        filesChanged: files.length,
        totalAdditions,
        totalDeletions,
        files,
        summary: this.generateSummary(files, totalAdditions, totalDeletions),
        languages,
      };

      logger.info("[DevPilot] Staged changes analyzed", {
        filesChanged: files.length,
        additions: totalAdditions,
        deletions: totalDeletions,
      });

      return analysis;
    } catch (error) {
      logger.error("[DevPilot] Failed to analyze staged changes", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Parse file changes from status output
   */
  private parseFileChanges(statusOutput: string, diffOutput: string): FileChange[] {
    const files: FileChange[] = [];
    const lines = statusOutput.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) {continue;}

      const parts = line.trim().split("\t");
      const status = parts[0] as "A" | "M" | "D" | "R" | "C" | "U";
      const fileName = parts[1] || parts[2]; // Handle renames

      // Count additions and deletions from diff for this file
      const { additions, deletions } = this.countLineChanges(fileName, diffOutput);

      files.push({
        fileName,
        status,
        additions,
        deletions,
        diff: this.extractFileDiff(fileName, diffOutput),
      });
    }

    return files;
  }

  /**
   * Count additions and deletions for a specific file
   */
  private countLineChanges(
    fileName: string,
    diffOutput: string
  ): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;

    // Simple line counting from diff markers
    const diffLines = diffOutput.split("\n");
    let inFile = false;

    for (const line of diffLines) {
      // Check if we're in the target file's diff section
      if (line.startsWith(`+++ b/${fileName}`) || line.startsWith(`--- a/${fileName}`)) {
        inFile = true;
        continue;
      }

      // Stop when we hit the next file
      if (line.startsWith("diff --git") && inFile) {
        break;
      }

      if (inFile) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          additions++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          deletions++;
        }
      }
    }

    return { additions, deletions };
  }

  /**
   * Extract diff for a specific file
   */
  private extractFileDiff(fileName: string, diffOutput: string): string {
    const diffLines = diffOutput.split("\n");
    const fileDiff: string[] = [];
    let inFile = false;

    for (const line of diffLines) {
      // Start collecting when we find the file
      if (
        line.startsWith(`+++ b/${fileName}`) ||
        line.startsWith(`--- a/${fileName}`) ||
        line.startsWith(`diff --git`)
      ) {
        inFile = true;
      }

      // Stop when we hit the next file
      if (inFile && line.startsWith("diff --git") && fileDiff.length > 0) {
        break;
      }

      if (inFile) {
        fileDiff.push(line);
      }
    }

    return fileDiff.join("\n");
  }

  /**
   * Detect programming languages from file extensions
   */
  private detectLanguages(
    files: FileChange[]
  ): Record<string, number> {
    const languages: Record<string, number> = {};

    const extensionMap: Record<string, string> = {
      ".ts": "TypeScript",
      ".js": "JavaScript",
      ".py": "Python",
      ".go": "Go",
      ".rs": "Rust",
      ".java": "Java",
      ".cs": "C#",
      ".cpp": "C++",
      ".c": "C",
      ".h": "C/C++",
      ".html": "HTML",
      ".css": "CSS",
      ".json": "JSON",
      ".xml": "XML",
      ".yaml": "YAML",
      ".yml": "YAML",
      ".sql": "SQL",
      ".sh": "Shell",
    };

    for (const file of files) {
      const ext = file.fileName.substring(file.fileName.lastIndexOf("."));
      const lang = extensionMap[ext] || "Other";
      languages[lang] = (languages[lang] || 0) + 1;
    }

    return languages;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    files: FileChange[],
    additions: number,
    deletions: number
  ): string {
    if (files.length === 0) {
      return "No staged changes";
    }

    const changeTypes = files.reduce(
      (acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const typeDescriptions: Record<string, string> = {
      A: "added",
      M: "modified",
      D: "deleted",
      R: "renamed",
      C: "copied",
      U: "unmerged",
    };

    const changes = Object.entries(changeTypes)
      .map(
        ([type, count]) =>
          `${count} ${typeDescriptions[type]} file${count > 1 ? "s" : ""}`
      )
      .join(", ");

    return `${changes} | +${additions} -${deletions}`;
  }

  /**
   * Get only staged changes (exclude unstaged and untracked)
   */
  async getStagedFilesOnly(): Promise<string[]> {
    if (!this.git) {
      throw new Error("[DevPilot] Git not initialized");
    }

    try {
      const output = await this.git.raw(["diff", "--cached", "--name-only"]);
      return output
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "");
    } catch (error) {
      logger.error("[DevPilot] Failed to get staged files", {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Validate that analysis only includes staged changes
   * (no unstaged or untracked files)
   */
  async validateStagedOnly(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    if (!this.git) {
      throw new Error("[DevPilot] Git not initialized");
    }

    const issues: string[] = [];

    try {
      // Check for unstaged changes
      const unstagedDiff = await this.git.diff();
      if (unstagedDiff.trim() !== "") {
        issues.push("Unstaged changes detected (will be excluded from analysis)");
      }

      // Check for untracked files
      const untracked = await this.git.raw(["ls-files", "--others", "--exclude-standard"]);
      if (untracked.trim() !== "") {
        issues.push("Untracked files detected (will be excluded from analysis)");
      }

      logger.info("[DevPilot] Staged-only validation", {
        valid: issues.length === 0,
        issues: issues.length,
      });

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error("[DevPilot] Failed validation", {
        error: String(error),
      });
      return {
        valid: false,
        issues: [`Validation error: ${String(error)}`],
      };
    }
  }
}

/**
 * Global instance
 */
let analyzer: StagedChangeAnalyzer | null = null;

export function initializeStagedAnalyzer(workspacePath: string): StagedChangeAnalyzer {
  analyzer = new StagedChangeAnalyzer(workspacePath);
  return analyzer;
}

export function getStagedAnalyzer(): StagedChangeAnalyzer {
  if (!analyzer) {
    throw new Error("[DevPilot] Staged change analyzer not initialized");
  }
  return analyzer;
}
