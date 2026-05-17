/**
 * DevPilot Learning Resources & Practice TreeView
 * 
 * Provides native TreeView for:
 * - Learning resources (organized by topic)
 * - Practice problems (by difficulty)
 * - Project templates
 */

import * as vscode from "vscode";
import { getLogger } from "../core/logger";
import { learningResourcesRegistry, LearningResource, getResourcesByCategory, getResourceById } from "../data/dashboard-data";

const logger = getLogger("LearningTreeView");

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: "resource" | "problem" | "template";
  topic: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  url?: string;
  content?: string;
  children?: Resource[];
}

/**
 * Learning Resources Tree Item
 */
class LearningTreeItem extends vscode.TreeItem {
  constructor(
    public readonly resource: Resource,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(resource.title, collapsibleState);

    this.description = resource.description;
    this.tooltip = `${resource.topic} • ${resource.difficulty || "reference"}`;

    // Set icons based on type
    switch (resource.type) {
      case "resource":
        this.iconPath = new vscode.ThemeIcon("book");
        break;
      case "problem":
        this.iconPath = new vscode.ThemeIcon("lightbulb");
        break;
      case "template":
        this.iconPath = new vscode.ThemeIcon("file-code");
        break;
    }

    // Add context menu
    this.contextValue = `learning-${resource.type}`;

    // Add click command for opening resources (especially important for leaf nodes with URLs)
    if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
      this.command = {
        title: "Open Resource",
        command: "devpilot.openLearningResource",
        arguments: [resource],
      };
    }
  }
}

/**
 * Learning TreeView Data Provider
 */
export class LearningTreeProvider implements vscode.TreeDataProvider<Resource> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    Resource | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private resources: Resource[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.resources = this.loadResources();
  }

  /**
   * Load learning resources from registry, organized by category
   */
  private loadResources(): Resource[] {
    const categories = [
      { id: "learn", title: "📘 Learn", icon: "book" },
      { id: "practice", title: "💻 Practice", icon: "code" },
      { id: "quizzes", title: "📝 Quizzes", icon: "lightbulb" },
      { id: "university", title: "🎓 University Aligned", icon: "graduation-cap" },
      { id: "regional", title: "🇵🇰 Regional Resources", icon: "globe" },
    ] as const;

    return categories
      .map((cat) => {
        const resourcesInCategory = getResourcesByCategory(cat.id as any);
        if (resourcesInCategory.length === 0) {return null;}

        return {
          id: cat.id,
          title: cat.title,
          description: `${resourcesInCategory.length} resources`,
          type: "resource",
          topic: cat.title,
          children: resourcesInCategory.map((res) => ({
            id: res.id,
            title: res.title,
            description: res.description,
            type: "resource",
            topic: res.category,
            url: res.url,
            difficulty: res.difficulty as any,
            content: `# ${res.title}\n\n${res.description}\n\nCategory: ${res.category}\nType: ${res.type}`,
          })),
        };
      })
      .filter((cat) => cat !== null) as Resource[];
  }

  /**
   * Get tree item
   */
  getTreeItem(resource: Resource): vscode.TreeItem {
    const state = resource.children
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    return new LearningTreeItem(resource, state);
  }

  /**
   * Get children of resource
   */
  getChildren(resource?: Resource): Resource[] {
    if (!resource) {
      return this.resources;
    }
    return resource.children || [];
  }

  /**
   * Get parent of resource
   */
  getParent(resource: Resource): Resource | undefined {
    return undefined;
  }

  /**
   * Refresh tree
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }
}

/**
 * Register learning TreeView
 */
export function registerLearningTreeView(
  context: vscode.ExtensionContext
): void {
  const treeProvider = new LearningTreeProvider(context);

  const treeView = vscode.window.createTreeView("devpilot.learning", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Command: Open resource
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "devpilot.openLearningResource",
      async (resource: Resource) => {
        try {
          logger.info("Opening learning resource", { id: resource.id, url: resource.url });
          
          if (resource.url) {
            // Parse and open URL in external browser
            const uri = vscode.Uri.parse(resource.url);
            await vscode.env.openExternal(uri);
            logger.info("Opened resource in browser", { resourceId: resource.id, url: resource.url });
            vscode.window.showInformationMessage(`📖 Opening ${resource.title}...`);
          } else if (resource.content) {
            // Show markdown content in editor
            const doc = await vscode.workspace.openTextDocument({
              language: "markdown",
              content: resource.content,
            });
            vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
            logger.info("Opened resource content", { resourceId: resource.id });
          } else {
            logger.warn("Resource has no URL or content", { resourceId: resource.id });
            vscode.window.showWarningMessage(`📚 Resource "${resource.title}" has no content available`);
          }
        } catch (error) {
          logger.error("Failed to open learning resource", { error: String(error) });
          vscode.window.showErrorMessage(`Failed to open resource: ${String(error)}`);
        }
      }
    )
  );

  logger.info("Learning TreeView registered");
}
