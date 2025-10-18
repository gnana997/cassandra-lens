/**
 * Main App component for Query Results webview
 *
 * Manages application state and renders appropriate view based on status:
 * - idle: Empty state with instructions
 * - executing: Loading spinner
 * - results: Table or JSON view with controls
 * - error: Error message with suggestions
 */

import { useState, useEffect } from 'react';
import { AppState, MessageToWebview, QueryResult, QueryError } from './types';
import ResultsTable from './components/ResultsTable';
import ResultsJSON from './components/ResultsJSON';
import ErrorDisplay from './components/ErrorDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import EmptyState from './components/EmptyState';

const App = () => {
  const [state, setState] = useState<AppState>({
    status: 'idle',
    viewMode: 'table',
    currentPage: 1,
    rowsPerPage: 100, // Keep for backward compatibility with AppState type
    sortDirection: 'asc'
  });

  // Manage page size separately for better control
  const [defaultPageSize, setDefaultPageSize] = useState(100);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  // Listen for messages from the extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent<MessageToWebview>) => {
      const message = event.data;

      switch (message.type) {
        case 'executing':
          setState(prev => ({
            ...prev,
            status: 'executing',
            currentQuery: message.query,
            result: undefined,
            error: undefined
          }));
          break;

        case 'results':
          setState(prev => ({
            ...prev,
            status: 'results',
            result: message.data,
            error: undefined,
            currentPage: 1 // Reset to first page
          }));
          // Update page size from extension setting
          const newDefaultPageSize = message.defaultPageSize || 100;
          setDefaultPageSize(newDefaultPageSize);
          setRowsPerPage(newDefaultPageSize); // Reset to default on new query
          break;

        case 'error':
          setState(prev => ({
            ...prev,
            status: 'error',
            error: message.error,
            result: undefined
          }));
          break;
      }
    };

    window.addEventListener('message', messageHandler);

    // Notify extension that webview is ready
    window.vscodeApi.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  const handleViewModeChange = (mode: 'table' | 'json') => {
    setState(prev => ({ ...prev, viewMode: mode }));
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  const handleSort = (column: string) => {
    setState(prev => ({
      ...prev,
      sortColumn: column,
      sortDirection:
        prev.sortColumn === column && prev.sortDirection === 'asc'
          ? 'desc'
          : 'asc'
    }));
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (state.result) {
      window.vscodeApi.postMessage({
        type: 'export',
        format,
        data: state.result
      });
    }
  };

  const handleCopyCell = (value: any) => {
    window.vscodeApi.postMessage({
      type: 'copyCell',
      data: value
    });
  };

  const handleRowsPerPageChange = (newSize: number) => {
    setRowsPerPage(newSize);
    setState(prev => ({ ...prev, currentPage: 1 })); // Reset to first page
  };

  const handleResetPageSize = () => {
    setRowsPerPage(defaultPageSize);
    setState(prev => ({ ...prev, currentPage: 1 })); // Reset to first page
  };

  return (
    <div className="app">
      {state.status === 'idle' && <EmptyState />}

      {state.status === 'executing' && (
        <LoadingSpinner query={state.currentQuery || ''} />
      )}

      {state.status === 'results' && state.result && (
        <div className="results-container">
          {/* Header with view mode toggle and export */}
          <div className="results-header">
            <div className="view-mode-toggle">
              <button
                className={state.viewMode === 'table' ? 'active' : ''}
                onClick={() => handleViewModeChange('table')}
                title="Table View"
              >
                Table
              </button>
              <button
                className={state.viewMode === 'json' ? 'active' : ''}
                onClick={() => handleViewModeChange('json')}
                title="JSON View"
              >
                JSON
              </button>
            </div>

            <div className="export-controls">
              <button onClick={() => handleExport('csv')} title="Export as CSV">
                Export CSV
              </button>
              <button onClick={() => handleExport('json')} title="Export as JSON">
                Export JSON
              </button>
            </div>
          </div>

          {/* Results display */}
          {state.viewMode === 'table' ? (
            <ResultsTable
              result={state.result}
              currentPage={state.currentPage}
              rowsPerPage={rowsPerPage}
              defaultPageSize={defaultPageSize}
              sortColumn={state.sortColumn}
              sortDirection={state.sortDirection}
              onPageChange={handlePageChange}
              onSort={handleSort}
              onCopyCell={handleCopyCell}
              onRowsPerPageChange={handleRowsPerPageChange}
              onResetPageSize={handleResetPageSize}
            />
          ) : (
            <ResultsJSON
              result={state.result}
              onCopyCell={handleCopyCell}
            />
          )}
        </div>
      )}

      {state.status === 'error' && state.error && (
        <ErrorDisplay error={state.error} />
      )}
    </div>
  );
};

export default App;
