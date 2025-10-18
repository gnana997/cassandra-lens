/**
 * CQL CodeLens Provider
 *
 * Provides inline "Run" buttons and connection indicators in CQL files using VS Code's CodeLens API.
 *
 * **Features:**
 * - File-level "▶ Run All" button at top of file
 * - Active connection indicator (clickable to switch)
 * - Multi-connection warning when file uses multiple connections via @conn directives
 * - Settings shortcut button
 * - Auto-refreshes when connection changes
 *
 * **Configuration Modes:**
 * - off: No CodeLens displayed
 * - minimal: Run All + connection indicator only
 * - standard: minimal + multi-connection warning
 * - detailed: standard + per-statement Run buttons (Phase 2)
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/connectionManager';
import { executionTimeTracker } from '../services/executionTimeTracker';

/**
 * Statement information with line tracking for CodeLens positioning.
 */
interface StatementInfo {
  text: string;
  startLine: number;      // First line of statement block (including comments)
  endLine: number;        // Last line of statement
  cqlStartLine: number;   // First line with actual CQL code (excluding comment-only lines)
}

export class CqlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private readonly connectionManager: ConnectionManager) {
    // Refresh CodeLens when connection changes
    connectionManager.on('statusChanged', () => {
      this._onDidChangeCodeLenses.fire();
    });

    connectionManager.on('connected', () => {
      this._onDidChangeCodeLenses.fire();
    });

    connectionManager.on('disconnected', () => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Provides CodeLens items for a document.
   *
   * @param document - The document to provide CodeLens for
   * @returns Array of CodeLens items
   */
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.languageId !== 'cql') {
      return [];
    }

    const config = vscode.workspace.getConfiguration('cassandraLens.editor');
    const mode = config.get<string>('codeLensMode', 'standard');

    if (mode === 'off') {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    // Always add file-level CodeLens (minimal, standard, detailed modes)
    lenses.push(...this.getFileLevelLenses(document, mode));

    // Add statement-level CodeLens in detailed mode (Phase 2)
    if (mode === 'detailed') {
      lenses.push(...this.getStatementLevelLenses(document));
    }

    return lenses;
  }

  /**
   * Provides file-level CodeLens items at the top of the file.
   *
   * @param document - The document
   * @param mode - CodeLens mode (minimal, standard, detailed)
   * @returns Array of file-level CodeLens items
   */
  private getFileLevelLenses(document: vscode.TextDocument, mode: string): vscode.CodeLens[] {
    const topOfFile = new vscode.Range(0, 0, 0, 0);
    const lenses: vscode.CodeLens[] = [];

    // Count statements for "Run All" button
    const statementCount = this.countStatements(document);

    // 1. Run All button (with file execution time if available)
    let runAllTitle = statementCount > 1
      ? `▶ Run All (${statementCount} statement${statementCount === 1 ? '' : 's'})`
      : '▶ Run All';

    // Add file execution time if available
    const fileExecutionTime = executionTimeTracker.getFileExecutionTime(document.uri.toString());
    if (fileExecutionTime !== undefined) {
      runAllTitle += `    ⏱ Last: ${fileExecutionTime}ms total`;
    }

    lenses.push(new vscode.CodeLens(topOfFile, {
      title: runAllTitle,
      command: 'cassandra-lens.executeQuery',
      tooltip: fileExecutionTime !== undefined
        ? `Execute all statements in file (Ctrl+Enter / Cmd+Enter)\n\nLast full execution: ${fileExecutionTime}ms`
        : 'Execute all statements in file (Ctrl+Enter / Cmd+Enter)'
    }));

    // 2. Connection indicator (all modes show this per user preference)
    const activeProfile = this.connectionManager.getActiveProfile();
    const isConnected = this.connectionManager.isConnected();

    const connIcon = isConnected ? '$(database)' : '$(debug-disconnect)';
    const connName = activeProfile?.name || 'No connection';
    const connColor = isConnected ? '' : ' $(warning)';

    lenses.push(new vscode.CodeLens(topOfFile, {
      title: `${connIcon} ${connName}${connColor}`,
      command: 'cassandra-lens.switchConnection',
      tooltip: isConnected
        ? `Connected to: ${connName}\nClick to switch connection`
        : 'Not connected. Click to connect'
    }));

    // 3. Multi-connection warning (standard and detailed modes only)
    if (mode === 'standard' || mode === 'detailed') {
      const connections = this.detectConnectionSwitches(document);
      if (connections.size > 1) {
        const connList = Array.from(connections).join(', ');
        lenses.push(new vscode.CodeLens(topOfFile, {
          title: `⚠️ ${connections.size} connections`,
          command: '', // No action
          tooltip: `This file uses multiple connections:\n${connList}\n\nStatements will prompt before switching connections.`
        }));
      }
    }

    // 4. Settings shortcut
    lenses.push(new vscode.CodeLens(topOfFile, {
      title: '⚙',
      command: 'workbench.action.openSettings',
      arguments: ['@ext:cassandra-lens'],
      tooltip: 'Open CassandraLens settings'
    }));

    return lenses;
  }

  /**
   * Counts the number of CQL statements in a document.
   *
   * @param document - The document to analyze
   * @returns Number of statements
   */
  private countStatements(document: vscode.TextDocument): number {
    const text = document.getText();
    const statements = this.parseStatements(text);
    return statements.length;
  }

  /**
   * Detects all connection names referenced via @conn directives in a document.
   *
   * @param document - The document to analyze
   * @returns Set of connection names (includes active connection if no directives found)
   */
  private detectConnectionSwitches(document: vscode.TextDocument): Set<string> {
    const connections = new Set<string>();
    const text = document.getText();

    // Add current active connection
    const activeProfile = this.connectionManager.getActiveProfile();
    if (activeProfile) {
      connections.add(activeProfile.name);
    }

    // Find all @conn directives
    const connMatches = text.matchAll(/^--\s*@conn\s+([a-zA-Z0-9_-]+)/gim);

    for (const match of connMatches) {
      connections.add(match[1]);
    }

    return connections;
  }

  /**
   * Parses CQL statements from text.
   * Reuses parsing logic similar to QueryCommands.parseStatements()
   *
   * @param text - The text to parse
   * @returns Array of statement texts
   */
  private parseStatements(text: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Track string boundaries (single and double quotes)
      if ((char === "'" || char === '"') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      // Split on semicolons outside of strings
      if (char === ';' && !inString) {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }

    // Add final statement if it doesn't end with semicolon
    const trimmed = currentStatement.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    // Filter out comments-only statements
    return statements.filter(stmt => {
      const withoutComments = stmt
        .replace(/--.*$/gm, '') // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .trim();
      return withoutComments.length > 0 && this.isValidStatement(withoutComments);
    });
  }

  /**
   * Checks if a statement is a valid CQL command.
   *
   * @param text - Statement text to validate
   * @returns True if valid CQL statement
   */
  private isValidStatement(text: string): boolean {
    const keywords = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|USE|BEGIN|APPLY|BATCH|DESCRIBE|DESC|LIST|COPY|SOURCE|CAPTURE|CONSISTENCY|SERIAL|PAGING|EXPAND|TRACING|HELP)\b/i;
    return keywords.test(text);
  }

  /**
   * Provides statement-level CodeLens items (one per CQL statement).
   * Displays "▶ Run" button with optional execution time on the line above each statement.
   *
   * @param document - The document
   * @returns Array of statement-level CodeLens items
   */
  private getStatementLevelLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const statements = this.parseStatementsWithLines(document);

    for (const statement of statements) {
      // Position CodeLens on line immediately above the actual CQL statement
      // (between comments and the CQL code)
      // If CQL starts at line 0, place it on line 0
      const lensLine = statement.cqlStartLine > 0 ? statement.cqlStartLine - 1 : 0;
      const range = new vscode.Range(lensLine, 0, lensLine, 0);

      // Check for execution time
      const executionRecord = executionTimeTracker.getLastExecution(
        document.uri.toString(),
        statement.startLine,
        statement.endLine
      );

      // Check for @conn directive first (search from where CQL starts, backwards into comments)
      const connDirective = this.findConnectionDirectiveForStatement(document, statement.cqlStartLine);

      // Build title with connection name and execution time
      let title = connDirective ? `▶ Run in ${connDirective}` : '▶ Run';
      if (executionRecord) {
        const timeStr = `⏱ Last: ${executionRecord.executionTime}ms`;
        title = `${title}    ${timeStr}`;
      }
      let tooltip = 'Execute this statement';
      if (connDirective) {
        tooltip = `Execute this statement\n@conn ${connDirective}`;
      }
      if (executionRecord) {
        const rowText = executionRecord.rowCount === 1 ? 'row' : 'rows';
        const statusIcon = executionRecord.success ? '✓' : '✗';
        tooltip += `\n\nLast execution: ${statusIcon} ${executionRecord.executionTime}ms, ${executionRecord.rowCount} ${rowText}`;
      }

      lenses.push(new vscode.CodeLens(range, {
        title,
        command: 'cassandra-lens.executeStatementAtLine',
        arguments: [document.uri.toString(), statement.startLine, statement.endLine],
        tooltip
      }));
    }

    return lenses;
  }

  /**
   * Finds a @conn directive in the lines before a statement.
   * Looks backwards up to 10 lines from the statement start, stopping at blank lines.
   *
   * @param document - The document
   * @param statementStartLine - Line number where statement starts (0-indexed)
   * @returns Connection name if found, undefined otherwise
   */
  private findConnectionDirectiveForStatement(document: vscode.TextDocument, statementStartLine: number): string | undefined {
    // Look backwards up to 10 lines for @conn directive
    for (let i = statementStartLine; i >= 0 && i >= statementStartLine - 10; i--) {
      const line = document.lineAt(i).text.trim();

      // Stop at blank lines
      if (line === '') {
        break;
      }

      // Check for @conn directive
      const match = line.match(/^--\s*@conn\s+([a-zA-Z0-9_-]+)/i);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Parses CQL statements with line tracking for CodeLens positioning.
   *
   * Similar to parseStatements(), but tracks the start and end line numbers
   * for each statement to enable accurate CodeLens placement.
   *
   * @param document - The document to parse
   * @returns Array of statement information with line numbers (0-indexed)
   */
  private parseStatementsWithLines(document: vscode.TextDocument): StatementInfo[] {
    const text = document.getText();
    const statements: StatementInfo[] = [];
    let currentStatement = '';
    let currentLine = 0;
    let statementStartLine = -1;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      // Track newlines
      if (char === '\n') {
        currentLine++;
      }

      // Track string boundaries (single and double quotes)
      if ((char === "'" || char === '"') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      // Split on semicolons outside of strings
      if (char === ';' && !inString) {
        const trimmed = currentStatement.trim();
        if (trimmed && statementStartLine >= 0) {
          // Filter out comment-only statements
          const withoutComments = trimmed
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();

          if (withoutComments.length > 0 && this.isValidStatement(withoutComments)) {
            // Find the first line with actual CQL code (not just comments)
            const cqlStartLine = this.findCqlStartLine(trimmed, statementStartLine);

            statements.push({
              text: trimmed,
              startLine: statementStartLine,
              endLine: currentLine,
              cqlStartLine
            });
          }
        }
        currentStatement = '';
        statementStartLine = -1; // Reset for next statement
      } else {
        // Track start of statement (first non-whitespace character)
        if (statementStartLine === -1 && char.trim()) {
          statementStartLine = currentLine;
        }
        currentStatement += char;
      }
    }

    // Add final statement if it doesn't end with semicolon
    const trimmed = currentStatement.trim();
    if (trimmed && statementStartLine >= 0) {
      const withoutComments = trimmed
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      if (withoutComments.length > 0 && this.isValidStatement(withoutComments)) {
        // Find the first line with actual CQL code (not just comments)
        const cqlStartLine = this.findCqlStartLine(trimmed, statementStartLine);

        statements.push({
          text: trimmed,
          startLine: statementStartLine,
          endLine: currentLine,
          cqlStartLine
        });
      }
    }

    return statements;
  }

  /**
   * Finds the first line in a statement that contains actual CQL code (not just comments).
   *
   * @param statementText - The full statement text (may include comments)
   * @param baseLineNumber - The line number where the statement starts in the document
   * @returns The line number where actual CQL code begins
   */
  private findCqlStartLine(statementText: string, baseLineNumber: number): number {
    const lines = statementText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Remove comments from this line
      const withoutComments = line
        .replace(/--.*$/, '')        // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove block comments
        .trim();

      // If this line has non-whitespace content after removing comments, it's the CQL start
      if (withoutComments.length > 0) {
        return baseLineNumber + i;
      }
    }

    // Fallback: if no CQL code found (shouldn't happen), return the base line
    return baseLineNumber;
  }
}
