/**
 * Query Results Webview Panel Manager
 *
 * Manages the webview panel that displays CQL query results.
 * Handles:
 * - Panel creation and lifecycle (singleton pattern)
 * - HTML generation with Content Security Policy
 * - Message passing between extension and webview
 * - Results display (table, JSON, errors)
 * - Export functionality (CSV, JSON)
 */

import * as vscode from 'vscode';

/**
 * Query result metadata and rows
 */
export interface QueryResult {
  /** Column metadata */
  columns: ColumnMetadata[];
  /** Result rows */
  rows: any[];
  /** Execution time in milliseconds */
  executionTime: number;
  /** Keyspace.table path */
  tablePath?: string;
  /** Query statement that was executed */
  query: string;
}

/**
 * Column metadata from Cassandra ResultSet
 */
export interface ColumnMetadata {
  name: string;
  type: string;
}

/**
 * Query execution error
 */
export interface QueryError {
  message: string;
  suggestion?: string;
  query: string;
}

/**
 * Message types sent from webview to extension
 */
export interface WebviewMessage {
  type: 'ready' | 'export' | 'copyCell';
  format?: 'csv' | 'json';
  data?: any;
}

/**
 * Message types sent from extension to webview
 */
export type MessageToWebview =
  | { type: 'executing'; query: string }
  | { type: 'results'; data: QueryResult }
  | { type: 'error'; error: QueryError };

/**
 * Manages the query results webview panel.
 */
export class QueryResultsPanel {
  /**
   * Track the currently active panel (only one at a time)
   */
  public static currentPanel: QueryResultsPanel | undefined;

  /**
   * The underlying webview panel
   */
  private readonly _panel: vscode.WebviewPanel;

  /**
   * Path to extension's dist directory
   */
  private readonly _extensionUri: vscode.Uri;

  /**
   * Disposables for cleanup
   */
  private _disposables: vscode.Disposable[] = [];

  /**
   * Flag indicating if the webview is ready to receive messages
   */
  private _isReady: boolean = false;

  /**
   * Queue for messages sent before the webview is ready
   */
  private _messageQueue: MessageToWebview[] = [];

  /**
   * Creates or shows the query results panel.
   *
   * @param extensionUri - The URI of the extension directory
   */
  public static createOrShow(extensionUri: vscode.Uri): QueryResultsPanel {
    // If we already have a panel, show it
    if (QueryResultsPanel.currentPanel) {
      QueryResultsPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two, false);
      return QueryResultsPanel.currentPanel;
    }

    // Otherwise, create a new panel in the second column (side-by-side with editor)
    const panel = vscode.window.createWebviewPanel(
      'cassandraQueryResults',
      'CQL Query Results',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      {
        // Enable JavaScript in the webview
        enableScripts: true,

        // Restrict the webview to only load resources from the extension's dist directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],

        // Retain context when hidden (preserves results when switching tabs)
        retainContextWhenHidden: true
      }
    );

    QueryResultsPanel.currentPanel = new QueryResultsPanel(panel, extensionUri);
    return QueryResultsPanel.currentPanel;
  }

  /**
   * Private constructor (use createOrShow instead)
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's HTML content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Listen for when the panel is disposed (user closes it)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case 'ready':
            // Webview is ready! Flush queued messages
            this._isReady = true;
            this._flushMessageQueue();
            console.log('Query results webview ready');
            break;

          case 'export':
            if (message.format && message.data) {
              await this._handleExport(message.format, message.data);
            }
            break;

          case 'copyCell':
            if (message.data) {
              await vscode.env.clipboard.writeText(String(message.data));
              vscode.window.showInformationMessage('Copied to clipboard');
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Posts a message to the webview, queuing it if webview isn't ready yet.
   * This solves the race condition where messages sent immediately after
   * panel creation get lost before the React app finishes mounting.
   *
   * @param message - The message to send to the webview
   */
  private postMessageOrQueue(message: MessageToWebview): void {
    if (this._isReady) {
      // Webview is ready, send immediately
      this._panel.webview.postMessage(message);
    } else {
      // Webview not ready yet, queue the message
      this._messageQueue.push(message);
    }
  }

  /**
   * Flushes all queued messages to the webview.
   * Called when the webview signals it's ready via the 'ready' message.
   */
  private _flushMessageQueue(): void {
    this._messageQueue.forEach(msg => {
      this._panel.webview.postMessage(msg);
    });
    this._messageQueue = [];
  }

  /**
   * Send a message to the webview indicating query execution has started.
   *
   * @param query - The query being executed
   */
  public showExecuting(query: string): void {
    this.postMessageOrQueue({
      type: 'executing',
      query
    } as MessageToWebview);
  }

  /**
   * Send query results to the webview for display.
   *
   * @param result - Query result data
   */
  public showResults(result: QueryResult): void {
    // Read the default page size from user settings
    const config = vscode.workspace.getConfiguration('cassandraLens.query');
    const defaultPageSize = config.get<number>('defaultPageSize', 100);

    this.postMessageOrQueue({
      type: 'results',
      data: result,
      defaultPageSize
    } as MessageToWebview);
  }

  /**
   * Send an error to the webview for display.
   *
   * @param error - Query error details
   */
  public showError(error: QueryError): void {
    this.postMessageOrQueue({
      type: 'error',
      error
    } as MessageToWebview);
  }

  /**
   * Handle export requests from the webview.
   *
   * @param format - Export format (csv or json)
   * @param data - Data to export
   */
  private async _handleExport(format: 'csv' | 'json', data: any): Promise<void> {
    try {
      const defaultFileName = `query_results_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const filters: { [name: string]: string[] } = {};

      if (format === 'csv') {
        filters['CSV Files'] = ['csv'];
        filters['All Files'] = ['*'];
      } else {
        filters['JSON Files'] = ['json'];
        filters['All Files'] = ['*'];
      }

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFileName + '.' + format),
        filters
      });

      if (uri) {
        let content: string;
        if (format === 'csv') {
          content = this._convertToCSV(data);
        } else {
          content = JSON.stringify(data, null, 2);
        }

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        vscode.window.showInformationMessage(`Results exported to ${uri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert data to CSV format.
   *
   * @param data - Query result data
   * @returns CSV string
   */
  private _convertToCSV(data: QueryResult): string {
    if (!data.rows || data.rows.length === 0) {
      return '';
    }

    // Get column names from first row
    const columns = data.columns.map(col => col.name);

    // CSV header
    const header = columns.map(col => this._escapeCSV(col)).join(',');

    // CSV rows
    const rows = data.rows.map(row => {
      return columns
        .map(col => {
          const value = row[col];
          return this._escapeCSV(this._formatValueForCSV(value));
        })
        .join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Escape a value for CSV format.
   *
   * @param value - Value to escape
   * @returns Escaped string
   */
  private _escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format a value for CSV export.
   *
   * @param value - Value to format
   * @returns Formatted string
   */
  private _formatValueForCSV(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Dispose the panel and clean up resources
   */
  public dispose(): void {
    QueryResultsPanel.currentPanel = undefined;

    // Reset message queue state
    this._isReady = false;
    this._messageQueue = [];

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Generates the HTML content for the webview.
   *
   * @param webview - The webview to generate HTML for
   * @returns HTML string
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to the bundled webview script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview-query-results.js')
    );

    // Generate a nonce to whitelist inline scripts (for CSP)
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <!--
    Content Security Policy (CSP) to restrict what the webview can do.
    Only allow scripts with the correct nonce or from our extension.
  -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    img-src ${webview.cspSource} https:;
    font-src ${webview.cspSource};
  ">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CQL Query Results</title>

  <style nonce="${nonce}">
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      overflow: hidden;
    }

    #root {
      width: 100%;
      height: 100vh;
      overflow: auto;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- Initialize VS Code API -->
  <script nonce="${nonce}">
    window.vscodeApi = acquireVsCodeApi();
  </script>

  <!-- Load the bundled React app -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

/**
 * Generate a random nonce for Content Security Policy.
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
