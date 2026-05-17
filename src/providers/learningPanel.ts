import * as vscode from 'vscode';
import { getLogger } from '../core/logger';
import { learningResourcesRegistry, getResourcesByLanguage } from '../data/dashboard-data';

const logger = getLogger('LearningPanel');

/**
 * Learning Resources WebView Panel Provider
 * Displays curated learning resources and documentation
 */
export class LearningPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devpilot.learning';
  private static instance: LearningPanelProvider;

  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    LearningPanelProvider.instance = this;
  }

  public static getInstance(): LearningPanelProvider | undefined {
    return LearningPanelProvider.instance;
  }

  public reveal(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    try {
      console.log('[DEBUG] LearningPanelProvider.resolveWebviewView called!');

      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._context.extensionUri],
      };

      webviewView.webview.html = this.getHtml();

      webviewView.webview.onDidReceiveMessage(async (data) => {
        switch (data.command) {
          case 'openLink':
            if (data.url) {
              await vscode.env.openExternal(vscode.Uri.parse(data.url));
            }
            break;
        }
      });

      logger.info('Learning panel resolved');
    } catch (error) {
      logger.error('Failed to resolve learning panel', { error: String(error) });
    }
  }

  private getHtml(): string {
    const learnResources = learningResourcesRegistry.filter(r => r.category === 'learn' && !r.topic);
    const practiceResources = learningResourcesRegistry.filter(r => r.category === 'practice' && !r.topic);
    const quizResources = learningResourcesRegistry.filter(r => r.category === 'quizzes');
    const universityResources = learningResourcesRegistry.filter(r => r.category === 'university');
    const regionalResources = learningResourcesRegistry.filter(r => r.category === 'regional');

    // Detect current language from active editor
    const currentLanguage = this.detectCurrentLanguage();
    
    // Get language-specific resources using helper function
    const languageSpecificResources = currentLanguage ? getResourcesByLanguage(currentLanguage) : [];
    
    // Get ALL language-specific resources grouped by language
    const allLanguageResources: any = {};
    
    // Collect all unique languages from resources
    const allLanguages = new Set<string>();
    learningResourcesRegistry.forEach(r => {
      if (r.topic) {
        allLanguages.add(r.topic);
      }
    });
    
    // Create emoji map for all languages
    const languageEmojiMap: { [key: string]: string } = {
      'java': ' Java',
      'rust': ' Rust',
      'go': ' Go',
      'csharp': '#️ C#',
      'cpp': ' C++',
      'css': ' CSS',
      'html': ' HTML',
      'python': ' Python',
      'javascript': ' JavaScript',
      'typescript': ' TypeScript',
      'react': ' React',
      'sql': ' SQL',
      'nodejs': ' Node.js'
    };
    
    // Group resources by language
    allLanguages.forEach(lang => {
      const langResources = learningResourcesRegistry.filter(r => r.topic === lang);
      const displayName = languageEmojiMap[lang] || `${lang}`;
      if (langResources.length > 0) {
        allLanguageResources[displayName] = langResources;
      }
    });

    const renderResourceCard = (resource: any) => `
      <div class="resource-card" onclick="openLink('${resource.url || '#'}')">
        <div class="resource-title"><span class="icon">${this.getIcon(resource.category)}</span> ${resource.title}</div>
        <div class="resource-description">${resource.description}</div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          <div class="tag">${resource.category}</div>
          ${resource.topic ? `<div class="tag" style="background: rgba(255,193,7,0.3); color: #ffc107;">${resource.topic}</div>` : ''}
          ${resource.difficulty ? `<div class="tag" style="background: rgba(156,39,176,0.3); color: #c939ce;">${resource.difficulty}</div>` : ''}
        </div>
      </div>
    `;

    const renderSection = (title: string, icon: string, resources: any[]) => {
      if (!resources || resources.length === 0) {
        return '';
      }
      return `
      <div class="section">
        <h2><span class="icon">${icon}</span> ${title}</h2>
        <div class="resource-grid">
          ${resources.map(r => renderResourceCard(r)).join('')}
        </div>
      </div>
    `;
    };

    let langSection = '';
    // Show current language resources if editing that language
    if (currentLanguage && languageSpecificResources.length > 0) {
      langSection = `
        <div class="section" style="background: linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(76,175,80,0.08) 100%); border-left: 4px solid #4caf50; padding: 14px; border-radius: 6px; margin-bottom: 16px;">
          <h2 style="color: #4caf50; margin-bottom: 12px;"><span class="icon">⭐</span> ${currentLanguage} Resources</h2>
          <div class="resource-grid">
            ${languageSpecificResources.map(r => renderResourceCard(r)).join('')}
          </div>
        </div>
      `;
    }
    
    // Build all language resources sections if not showing specific language
    let allLangSections = '';
    if (!currentLanguage || languageSpecificResources.length === 0) {
      allLangSections = Object.entries(allLanguageResources).map(([lang, resources]: [string, any]) => renderSection(`${lang} Resources`, '💻', resources as any)).join('');
    }

    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Learning Resources</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          padding: 16px;
          line-height: 1.6;
        }

        .container {
          max-width: 100%;
        }

        h2 {
          font-size: 16px;
          margin-bottom: 12px;
          color: var(--vscode-descriptionForeground);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        .section {
          margin-bottom: 24px;
        }

        .resource-grid {
          display: grid;
          gap: 12px;
        }

        .resource-card {
          background: var(--vscode-panel-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          color: var(--vscode-editor-foreground);
        }

        .resource-card:hover {
          background: var(--vscode-list-hoverBackground);
          border-color: var(--vscode-focusBorder);
          transform: translateX(4px);
        }

        .resource-card:active {
          opacity: 0.8;
        }

        .resource-title {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .resource-description {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          line-height: 1.4;
          margin-bottom: 6px;
        }

        .icon {
          font-size: 16px;
        }

        .tag {
          display: inline-block;
          background: var(--vscode-inputOption-activeBorder);
          color: var(--vscode-inputOption-activeForeground);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          opacity: 0.7;
          text-transform: capitalize;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${langSection}
        ${allLangSections}
        ${renderSection(' Learn', '', learnResources)}
        ${renderSection(' Practice', '', practiceResources)}
        ${renderSection(' Quizzes', '', quizResources)}
        ${renderSection(' University', '', universityResources)}
        ${renderSection('🇵🇰 Regional', '', regionalResources)}
      </div>

      <script>
        const vscode = acquireVsCodeApi();

        function openLink(url) {
          if (url && url !== '#') {
            vscode.postMessage({
              command: 'openLink',
              url: url
            });
          }
        }
      </script>
    </body>
    </html>`;
  }

  private detectCurrentLanguage(): string | null {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return null;
    }

    const languageMap: { [key: string]: string } = {
      'typescript': 'TypeScript',
      'javascript': 'JavaScript',
      'python': 'Python',
      'java': 'Java',
      'sql': 'SQL',
      'jsx': 'React',
      'tsx': 'React',
      'go': 'Go',
      'rust': 'Rust',
      'cpp': 'C++',
      'c': 'C',
      'csharp': 'C#',
      'css': 'CSS',
      'html': 'HTML',
      'scss': 'CSS'
    };

    const langId = activeEditor.document.languageId;
    return languageMap[langId] || null;
  }

  private getIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'learn': '',
      'practice': '',
      'quizzes': '',
      'university': '',
      'regional': ''
    };
    return icons[category] || '';
  }
}

export function registerLearningPanel(context: vscode.ExtensionContext) {
  try {
    console.log('[DEBUG] Starting registerLearningPanel');
    const provider = new LearningPanelProvider(context);
    console.log('[DEBUG] LearningPanelProvider created, viewType:', LearningPanelProvider.viewType);

    const disposable = vscode.window.registerWebviewViewProvider(
      LearningPanelProvider.viewType,
      provider
    );
    console.log('[DEBUG] registerWebviewViewProvider returned:', disposable);

    context.subscriptions.push(disposable);
    console.log('[DEBUG] Disposable pushed to subscriptions');

    logger.info('Learning panel registered');
  } catch (error) {
    console.error('[DEBUG] CRITICAL ERROR:', error);
    logger.error('Failed to register learning panel', { error: String(error) });
  }
}
