# Webviews

This directory contains **webview implementations** for CassandraLens.

## What Are Webviews?

Webviews are custom HTML/CSS/JavaScript panels within VS Code. They allow you to build rich UIs beyond what VS Code's standard components provide. This extension uses **React** for webview UIs.

## Currently Implemented Webviews

### Connection Form Webview
**Purpose**: Interactive multi-step form for creating and editing Cassandra connection profiles

**Files**:
- **`ConnectionFormPanel.ts`** - Webview panel manager (extension side)
- **`connectionForm/App.tsx`** - React application with multi-step form logic
- **`connectionForm/index.tsx`** - React entry point and rendering

**Features**:
- **Step 1 - Basic Info**: Connection name, contact points, port, datacenter, keyspace
- **Step 2 - Authentication**: Optional username/password authentication
- **Step 3 - SSL/TLS**: Optional SSL configuration with certificate verification
- **Step 4 - Review & Test**: Summary view with test connection button
- **Validation**: Inline validation for all fields
- **Test Connection**: Tests connection before saving
- **Edit Mode**: Pre-fills form when editing existing connections
- **Auto-styling**: Uses VS Code CSS variables for theme support

## Webview Architecture

### Extension Side (ConnectionFormPanel.ts)
Manages the webview panel lifecycle:

```typescript
export class ConnectionFormPanel {
  // Singleton pattern - only one panel at a time
  public static currentPanel: ConnectionFormPanel | undefined;

  // Create or show the panel
  public static createOrShow(
    extensionUri: vscode.Uri,
    existingProfile?: ConnectionProfile,
    onSave?: (profile: Partial<ConnectionProfile>) => Promise<void>,
    onTest?: (profile: Partial<ConnectionProfile>) => Promise<TestResult>
  ): void;

  // Generate HTML with proper CSP and nonces
  private _getHtmlForWebview(webview: vscode.Webview): string;

  // Handle messages from webview
  webview.onDidReceiveMessage((message: WebviewMessage) => {
    if (message.type === 'save') { /* ... */ }
    if (message.type === 'test') { /* ... */ }
  });
}
```

### Webview Side (React App)
React application running inside the webview:

```typescript
// Form state management
const [form, setForm] = useState<FormState>({
  name: '',
  contactPoints: [''],
  port: 9042,
  localDatacenter: 'datacenter1',
  auth: { enabled: false },
  ssl: { enabled: false },
});

// Send messages to extension
window.vscodeApi.postMessage({
  type: 'save',
  payload: form
});

// Receive messages from extension
window.addEventListener('message', (event) => {
  if (event.data.type === 'testResult') {
    // Handle test result
  }
});
```

## Communication Pattern

Webviews communicate with the extension via message passing:

**Extension → Webview:**
```typescript
// Send test result to webview
this._panel.webview.postMessage({
  type: 'testResult',
  success: true,
  message: 'Connected successfully!'
});
```

**Webview → Extension:**
```typescript
// Test connection from webview
window.vscodeApi.postMessage({
  type: 'test',
  payload: formData
});
```

## Build Configuration

Webviews are bundled separately from the extension:

**`webpack.config.cjs`** includes two configurations:
1. **Extension bundle** (Node.js target) - `extension.js`
2. **Webview bundle** (Browser target) - `webview.js`

The webview bundle:
- Uses React 19
- Targets browser environment
- Uses webpack DefinePlugin to provide `process.env` for React
- Outputs to `dist/webview.js`

## Security

Webviews are sandboxed and require explicit configuration:
- **CSP (Content Security Policy)**: Restricts what resources can load
- **Nonce-based script execution**: Only scripts with correct nonce can run
- **Local resource loading**: Uses `webview.asWebviewUri()` for extension resources
- **Message validation**: Validates all messages between extension and webview

Example CSP:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  style-src ${webview.cspSource} 'unsafe-inline';
  script-src 'nonce-${nonce}';
  img-src ${webview.cspSource} https:;
  font-src ${webview.cspSource};
">
```

## Styling

Uses VS Code CSS variables for automatic theme support:

```css
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
}

button.primary {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
```

## Best Practices

- **State management**: Use `retainContextWhenHidden: true` to preserve state when panel is hidden
- **Resource URIs**: Always use `webview.asWebviewUri()` for local resources
- **Theme awareness**: Use CSS variables for colors to support light/dark themes
- **Performance**: Keep virtual DOM updates efficient
- **Accessibility**: Provide proper labels and keyboard navigation
- **Validation**: Validate on both webview side (UX) and extension side (security)

## Future Enhancements

Future webviews may include:
- **Query Editor** - Interactive CQL query editor with results display
- **Data Browser** - Spreadsheet-like table data viewer with CRUD operations
- **Cluster Status** - Visual cluster topology and node status dashboard
- **Query History** - Searchable query history with re-run functionality
