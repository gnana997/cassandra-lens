# Webviews

This directory contains **webview implementations** for CassandraLens.

## What Are Webviews?

Webviews are custom HTML/CSS/JavaScript panels within VS Code. They allow you to build rich UIs beyond what VS Code's standard components provide.

## Webviews in CassandraLens

### Query Editor
- **Files**: `queryEditor.ts`, `queryEditor.html`, `queryEditor.css`, `queryEditor.js`
- **Purpose**: Interactive CQL query editor with results display
- **Features**:
  - Multi-line query input
  - Execute button and keyboard shortcut handling
  - Results table with pagination
  - Export to CSV/JSON
  - Consistency level selector
  - Execution time display

### Cluster Status Panel
- **Files**: `clusterStatus.ts`, `clusterStatus.html`
- **Purpose**: Displays cluster topology and node status
- **Features**:
  - Cluster name and version
  - Datacenter and rack information
  - Node list with status indicators
  - Refresh button

### Query History Panel
- **Files**: `queryHistory.ts`, `queryHistory.html`
- **Purpose**: Shows recently executed queries
- **Features**:
  - Searchable query history
  - Re-run or copy previous queries
  - Execution time and status indicators

## Webview Architecture

Each webview typically has:
1. **Controller** (`.ts` file) - TypeScript code that runs in VS Code extension host
2. **HTML** (`.html` file) - The webview's structure
3. **CSS** (`.css` file) - Styling
4. **Client Script** (`.js` file) - JavaScript that runs inside the webview

## Communication Pattern

Webviews communicate with the extension via message passing:

```typescript
// Extension → Webview
webview.postMessage({ type: 'queryResults', data: results });

// Webview → Extension
webview.onDidReceiveMessage(message => {
  if (message.type === 'executeQuery') {
    // Handle query execution
  }
});
```

## Security

Webviews are sandboxed and require explicit configuration:
- **CSP (Content Security Policy)**: Restricts what resources can load
- **Local resource loading**: Must use `asWebviewUri()`
- **Script execution**: Must enable scripts explicitly

## UI Toolkit

CassandraLens uses [@vscode/webview-ui-toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit) for consistent styling:
- Components automatically match VS Code theme (light/dark)
- Accessible components out of the box
- Includes buttons, inputs, data grids, dropdowns, etc.

## Example Usage

```typescript
// Create webview panel
const panel = vscode.window.createWebviewPanel(
  'cassandraQuery',
  'CQL Query',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    retainContextWhenHidden: true
  }
);

// Load HTML content
panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
```

## Best Practices

- **State management**: Use `retainContextWhenHidden` to preserve state when panel is hidden
- **Resource URIs**: Always use `webview.asWebviewUri()` for local resources
- **Theme awareness**: Use CSS variables for colors to support light/dark themes
- **Performance**: Virtualize large lists (don't render 10,000 rows at once)
- **Accessibility**: Provide keyboard navigation and ARIA labels
