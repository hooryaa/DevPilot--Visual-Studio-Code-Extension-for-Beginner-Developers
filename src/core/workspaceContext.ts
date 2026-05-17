/**
 * DevPilot Workspace Context Manager
 * Manages project structure, dependencies, and workspace awareness
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getLogger } from "./logger";

const logger = getLogger("WorkspaceContext");

export interface ProjectMetadata {
  name: string;
  version: string;
  type: "node" | "python" | "go" | "rust" | "generic";
  description?: string;
  dependencies: string[];
  devDependencies: string[];
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
}

export interface FileContext {
  path: string;
  language: string;
  imports: string[];
  exports: string[];
  size: number;
  lastModified: number;
}

export interface WorkspaceStructure {
  root: string;
  folders: string[];
  files: FileContext[];
  metadata: ProjectMetadata | null;
}

/**
 * Workspace Context Manager
 */
export class WorkspaceContextManager {
  private workspaceFolder: vscode.WorkspaceFolder | null = null;
  private projectMetadata: ProjectMetadata | null = null;
  private fileCache = new Map<string, FileContext>();
  private structureCache: WorkspaceStructure | null = null;

  constructor(workspaceFolder?: vscode.WorkspaceFolder) {
    if (workspaceFolder) {
      this.setWorkspace(workspaceFolder);
    }
  }

  /**
   * Set current workspace
   */
  setWorkspace(folder: vscode.WorkspaceFolder): void {
    this.workspaceFolder = folder;
    this.projectMetadata = null;
    this.fileCache.clear();
    this.structureCache = null;

    logger.info(`Workspace set: ${folder.name}`, { uri: folder.uri.fsPath });
  }

  /**
   * Get project metadata (package.json, pyproject.toml, etc.)
   */
  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    if (this.projectMetadata) {
      return this.projectMetadata;
    }

    if (!this.workspaceFolder) {
      return null;
    }

    const rootPath = this.workspaceFolder.uri.fsPath;

    // Try package.json (Node.js)
    const packageJsonPath = path.join(rootPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, "utf-8");
        const pkg = JSON.parse(content);

        this.projectMetadata = {
          name: pkg.name || "unknown",
          version: pkg.version || "0.0.0",
          type: "node",
          description: pkg.description,
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {}),
          scripts: pkg.scripts,
          engines: pkg.engines,
        };

        logger.debug("Package.json found and parsed");
        return this.projectMetadata;
      } catch (error) {
        logger.error("Failed to parse package.json", { error });
      }
    }

    // Try pyproject.toml (Python)
    const pyprojectPath = path.join(rootPath, "pyproject.toml");
    if (fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, "utf-8");
        const name = content.match(/name\s*=\s*['"](.*?)['"]/)?.[1] || "unknown";
        const version = content.match(/version\s*=\s*['"](.*?)['"]/)?.[1] || "0.0.0";

        this.projectMetadata = {
          name,
          version,
          type: "python",
          dependencies: [],
          devDependencies: [],
        };

        logger.debug("pyproject.toml found and parsed");
        return this.projectMetadata;
      } catch (error) {
        logger.error("Failed to parse pyproject.toml", { error });
      }
    }

    // Try go.mod (Go)
    const goModPath = path.join(rootPath, "go.mod");
    if (fs.existsSync(goModPath)) {
      try {
        const content = fs.readFileSync(goModPath, "utf-8");
        const moduleName = content.split("\n")[0]?.replace("module ", "").trim() || "unknown";

        this.projectMetadata = {
          name: moduleName,
          version: "1.0.0",
          type: "go",
          dependencies: [],
          devDependencies: [],
        };

        logger.debug("go.mod found and parsed");
        return this.projectMetadata;
      } catch (error) {
        logger.error("Failed to parse go.mod", { error });
      }
    }

    logger.info("No project metadata found");
    return null;
  }

  /**
   * Get all source files in workspace
   */
  async getSourceFiles(
    patterns: string[] = ["**/*.{ts,tsx,js,jsx,py,go,rs}"]
  ): Promise<vscode.Uri[]> {
    if (!this.workspaceFolder) {
      return [];
    }

    try {
      const files: vscode.Uri[] = [];
      for (const pattern of patterns) {
        const found = await vscode.workspace.findFiles(
          new vscode.RelativePattern(this.workspaceFolder, pattern),
          "**/node_modules/**"
        );
        files.push(...found);
      }
      return files;
    } catch (error) {
      logger.error("Failed to find source files", { error });
      return [];
    }
  }

  /**
   * Get dependencies for a file
   */
  async getFileDependencies(fileUri: vscode.Uri): Promise<string[]> {
    try {
      const content = fs.readFileSync(fileUri.fsPath, "utf-8");
      const deps = new Set<string>();

      // JavaScript/TypeScript imports
      const importRegex = /(?:import|from|require)\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        deps.add(match[1]);
      }

      // Python imports
      const pyImportRegex = /(?:from|import)\s+([^\s]+)/g;
      while ((match = pyImportRegex.exec(content)) !== null) {
        deps.add(match[1]);
      }

      return Array.from(deps);
    } catch (error) {
      logger.error(`Failed to get dependencies for ${fileUri.fsPath}`, { error });
      return [];
    }
  }

  /**
   * Get directory structure
   */
  async getDirectoryStructure(
    dirPath?: string,
    maxDepth: number = 3
  ): Promise<string[]> {
    if (!this.workspaceFolder) {
      return [];
    }

    const basePath = dirPath || this.workspaceFolder.uri.fsPath;

    try {
      const items = fs.readdirSync(basePath);
      const structure: string[] = [];

      for (const item of items) {
        const fullPath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);
        const relativePath = path.relative(
          this.workspaceFolder.uri.fsPath,
          fullPath
        );

        if (stat.isDirectory()) {
          structure.push(`${relativePath}/`);

          // Recursively add subdirectories
          if (maxDepth > 0 && !this.isIgnoredDirectory(relativePath)) {
            const subItems = await this.getDirectoryStructure(fullPath, maxDepth - 1);
            structure.push(...subItems);
          }
        } else {
          structure.push(relativePath);
        }
      }

      return structure;
    } catch (error) {
      logger.error(`Failed to get directory structure for ${basePath}`, {
        error,
      });
      return [];
    }
  }

  /**
   * Find file by name in workspace
   */
  async findFile(filename: string): Promise<vscode.Uri | null> {
    if (!this.workspaceFolder) {
      return null;
    }

    try {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.workspaceFolder, `**/${filename}`),
        "**/node_modules/**"
      );
      return files[0] || null;
    } catch (error) {
      logger.error(`Failed to find file ${filename}`, { error });
      return null;
    }
  }

  /**
   * Get related files (same directory, same extension)
   */
  async getRelatedFiles(fileUri: vscode.Uri): Promise<vscode.Uri[]> {
    if (!this.workspaceFolder) {
      return [];
    }

    try {
      const ext = path.extname(fileUri.fsPath);
      const dir = path.dirname(fileUri.fsPath);
      const relativePath = path.relative(
        this.workspaceFolder.uri.fsPath,
        dir
      );

      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.workspaceFolder, `${relativePath}/*${ext}`),
        "**/node_modules/**"
      );

      return files.filter((f) => f.fsPath !== fileUri.fsPath);
    } catch (error) {
      logger.error("Failed to get related files", { error });
      return [];
    }
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(): Promise<{
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
  }> {
    const files = await this.getSourceFiles();
    let totalLines = 0;
    const languages: Record<string, number> = {};

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.fsPath, "utf-8");
        const lines = content.split("\n").length;
        totalLines += lines;

        const ext = path.extname(file.fsPath);
        languages[ext] = (languages[ext] || 0) + 1;
      } catch (error) {
        // Silently skip unreadable files
      }
    }

    return {
      totalFiles: files.length,
      totalLines,
      languages,
    };
  }

  private isIgnoredDirectory(dirPath: string): boolean {
    const ignored = [
      "node_modules",
      ".git",
      "dist",
      "build",
      "out",
      ".vscode",
      "__pycache__",
      ".pytest_cache",
      "target",
    ];
    return ignored.some((dir) => dirPath.includes(dir));
  }
}

/**
 * Global workspace context manager
 */
let contextManager: WorkspaceContextManager | null = null;

export function initializeWorkspaceContext(): WorkspaceContextManager {
  const folders = vscode.workspace.workspaceFolders;
  const mainFolder = folders?.[0];

  if (!contextManager && mainFolder) {
    contextManager = new WorkspaceContextManager(mainFolder);
  }

  return contextManager || new WorkspaceContextManager();
}

export function getWorkspaceContext(): WorkspaceContextManager {
  if (!contextManager) {
    contextManager = initializeWorkspaceContext();
  }
  return contextManager;
}
