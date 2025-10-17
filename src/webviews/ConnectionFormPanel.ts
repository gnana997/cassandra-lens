/**
 * Connection Form Webview Panel Manager
 *
 * Manages the webview panel that hosts the React connection form.
 * Handles:
 * - Panel creation and lifecycle
 * - HTML generation with Content Security Policy
 * - Message passing between extension and webview
 * - Resource disposal
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ConnectionProfile } from '../types/connection';

/**
 * Message types sent from webview to extension
 */
export interface WebviewMessage {
  type: 'save' | 'test' | 'cancel';
  payload?: Partial<ConnectionProfile>;
}

/**
 * Manages the connection form webview panel.
 */
export class ConnectionFormPanel {
  /**
   * Track the currently active panel (only one at a time)
   */
  public static currentPanel: ConnectionFormPanel | undefined;

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
   * Callback for when connection is saved
   */
  private _onSave?: (profile: Partial<ConnectionProfile>) => Promise<void>;

  /**
   * Callback for when connection test is requested
   */
  private _onTest?: (profile: Partial<ConnectionProfile>) => Promise<{ success: boolean; message: string }>;

  /**
   * Creates or shows the connection form panel.
   *
   * @param extensionUri - The URI of the extension directory
   * @param existingProfile - Optional profile to edit (pre-fills form)
   * @param onSave - Callback when user saves the connection
   * @param onTest - Callback when user tests the connection
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    existingProfile?: ConnectionProfile,
    onSave?: (profile: Partial<ConnectionProfile>) => Promise<void>,
    onTest?: (profile: Partial<ConnectionProfile>) => Promise<{ success: boolean; message: string }>
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ConnectionFormPanel.currentPanel) {
      ConnectionFormPanel.currentPanel._panel.reveal(column);
      // Update with new profile if provided
      if (existingProfile) {
        ConnectionFormPanel.currentPanel._panel.webview.postMessage({
          type: 'loadProfile',
          profile: existingProfile
        });
      }
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'cassandraConnectionForm',
      existingProfile ? `Edit Connection: ${existingProfile.name}` : 'New Cassandra Connection',
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,

        // Restrict the webview to only load resources from the extension's dist directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],

        // Retain context when hidden
        retainContextWhenHidden: true
      }
    );

    ConnectionFormPanel.currentPanel = new ConnectionFormPanel(
      panel,
      extensionUri,
      existingProfile,
      onSave,
      onTest
    );
  }

  /**
   * Private constructor (use createOrShow instead)
   */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    existingProfile?: ConnectionProfile,
    onSave?: (profile: Partial<ConnectionProfile>) => Promise<void>,
    onTest?: (profile: Partial<ConnectionProfile>) => Promise<{ success: boolean; message: string }>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._onSave = onSave;
    this._onTest = onTest;

    // Set the webview's HTML content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, existingProfile);

    // Listen for when the panel is disposed (user closes it)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.type) {
          case 'save':
            if (this._onSave && message.payload) {
              try {
                await this._onSave(message.payload);
                // Close panel on successful save
                this._panel.dispose();
              } catch (error) {
                // Send error back to webview
                this._panel.webview.postMessage({
                  type: 'error',
                  message: error instanceof Error ? error.message : 'Failed to save connection'
                });
              }
            }
            break;

          case 'test':
            if (this._onTest && message.payload) {
              try {
                const result = await this._onTest(message.payload);
                // Send test result back to webview
                this._panel.webview.postMessage({
                  type: 'testResult',
                  success: result.success,
                  message: result.message
                });
              } catch (error) {
                this._panel.webview.postMessage({
                  type: 'testResult',
                  success: false,
                  message: error instanceof Error ? error.message : 'Test failed'
                });
              }
            }
            break;

          case 'cancel':
            this._panel.dispose();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Dispose the panel and clean up resources
   */
  public dispose(): void {
    ConnectionFormPanel.currentPanel = undefined;

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
   * @param existingProfile - Optional profile to pre-fill the form
   * @returns HTML string
   */
  private _getHtmlForWebview(webview: vscode.Webview, existingProfile?: ConnectionProfile): string {
    // Get the local path to the bundled webview script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );

    // Generate a nonce to whitelist inline scripts (for CSP)
    const nonce = getNonce();

    // Serialize profile data for initial state
    const initialData = existingProfile ? JSON.stringify(existingProfile) : 'null';

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
  <title>Cassandra Connection</title>

  <style nonce="${nonce}">
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    #root {
      width: 100%;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- Pass initial data to the React app -->
  <script nonce="${nonce}">
    window.initialProfile = ${initialData};
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
