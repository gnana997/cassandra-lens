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
   * Removes line and block comments from a single line of text.
   *
   * @param line - The line to process
   * @returns Line with comments removed
   */
  private removeComments(line: string): string {
    // Remove line comments (-- to end of line)
    const withoutLineComments = line.replace(/--.*$/, '');

    // Remove block comments (/* ... */ on same line)
    const withoutBlockComments = withoutLineComments.replace(/\/\*.*?\*\//g, '');

    return withoutBlockComments.trim();
  }

  /**
   * Checks if a line contains a CQL keyword anywhere (not just at start).
   * More flexible than isValidStatement which requires keyword at start.
   *
   * @param line - Line text (should have comments removed first)
   * @returns True if line contains a CQL keyword
   */
  private containsCqlKeyword(line: string): boolean {
    // Use word boundaries \b to match keywords anywhere in the line
    const keywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|USE|BEGIN|APPLY|BATCH|DESCRIBE|DESC|GRANT|REVOKE|LIST)\b/i;
    return keywords.test(line);
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
      // Place CodeLens at the start of the CQL statement line
      // VS Code renders it visually "above" the code on that line
      const range = new vscode.Range(statement.cqlStartLine, 0, statement.cqlStartLine, 0);

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
      const match = line.match(/^--\s*@conn\s+(.+)$/i);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Parses CQL statements with line tracking for CodeLens positioning.
   *
   * Uses a line-by-line document parsing approach for accurate line number tracking.
   * This method directly uses VS Code's document.lineAt() to avoid offset calculation errors.
   *
   * @param document - The document to parse
   * @returns Array of statement information with accurate line numbers (0-indexed)
   */
  private parseStatementsWithLines(document: vscode.TextDocument): StatementInfo[] {
    const statements: StatementInfo[] = [];

    // State tracking
    let inStatement = false;
    let statementStartLine = -1;
    let cqlStartLine = -1;
    let statementLines: string[] = [];

    // String literal tracking
    let inString = false;
    let stringChar = '';

    // Block comment tracking (for multi-line /* */ comments)
    let blockCommentDepth = 0;

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const originalLine = document.lineAt(lineNum).text;
      let processedLine = originalLine;

      // Process line character-by-character to handle strings and comments
      let foundSemicolon = false;

      for (let i = 0; i < originalLine.length; i++) {
        const char = originalLine[i];
        const nextChar = i < originalLine.length - 1 ? originalLine[i + 1] : '';
        const prevChar = i > 0 ? originalLine[i - 1] : '';

        // Handle block comment start (/*) and end (*/)
        if (!inString) {
          if (char === '/' && nextChar === '*') {
            blockCommentDepth++;
            i++; // Skip the asterisk
            continue;
          }
          if (char === '*' && nextChar === '/' && blockCommentDepth > 0) {
            blockCommentDepth--;
            i++; // Skip the slash
            continue;
          }
        }

        // Handle string boundaries (ignore if inside block comment)
        if (blockCommentDepth === 0) {
          if ((char === "'" || char === '"') && prevChar !== '\\') {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
              stringChar = '';
            }
          }
        }

        // Handle semicolon (statement terminator) - only if outside strings and comments
        if (char === ';' && !inString && blockCommentDepth === 0) {
          foundSemicolon = true;
          break; // Stop processing this line
        }
      }

      // Check if this line starts a new statement
      // Remove comments to check for CQL keywords
      const lineWithoutComments = this.removeComments(originalLine);

      if (!inStatement && lineWithoutComments.length > 0 && this.containsCqlKeyword(lineWithoutComments)) {
        // Start of new statement detected
        inStatement = true;
        statementStartLine = lineNum;
        cqlStartLine = lineNum; // Direct document line number
      }

      // Collect line if we're inside a statement
      if (inStatement) {
        statementLines.push(originalLine);
      }

      // Finalize statement if semicolon found
      if (foundSemicolon && inStatement) {
        const statementText = statementLines.join('\n');

        // Validate that the statement has actual CQL code (not just comments)
        const withoutComments = statementText
          .replace(/--.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .trim();

        const trimmedStatement = withoutComments.trim();
        if (trimmedStatement.length > 0 && this.isValidStatement(trimmedStatement)) {
          statements.push({
            text: statementText,
            startLine: statementStartLine,
            endLine: lineNum,
            cqlStartLine: cqlStartLine
          });
        }

        // Reset state for next statement
        inStatement = false;
        statementLines = [];
        statementStartLine = -1;
        cqlStartLine = -1;
      }

      // Reset string state at end of each line
      // SQL/CQL strings cannot span multiple lines, so inString must be false at line boundaries
      // If we don't reset this, a mismatched quote will corrupt parsing of the entire rest of the file
      if (inString) {
        inString = false;
        stringChar = '';
      }
    }

    // Handle statement without ending semicolon (e.g., last statement in file)
    if (inStatement && statementLines.length > 0) {
      const statementText = statementLines.join('\n');

      const withoutComments = statementText
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      const trimmedStatement = withoutComments.trim();
      if (trimmedStatement.length > 0 && this.isValidStatement(trimmedStatement)) {
        statements.push({
          text: statementText,
          startLine: statementStartLine,
          endLine: document.lineCount - 1,
          cqlStartLine: cqlStartLine
        });
      }
    }

    return statements;
  }

}
