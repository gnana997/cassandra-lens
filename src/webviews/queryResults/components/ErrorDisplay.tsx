/**
 * Error Display component
 *
 * Displays query execution errors with helpful suggestions
 */

import { QueryError } from '../types';

interface ErrorDisplayProps {
  error: QueryError;
}

const ErrorDisplay = ({ error }: ErrorDisplayProps) => {
  return (
    <div className="error-container">
      <div className="error-box">
        <div className="error-header">
          <span className="error-icon">⚠️</span>
          <h2 className="error-title">Query Execution Error</h2>
        </div>

        <p className="error-message">{error.message}</p>

        {error.suggestion && (
          <div className="error-suggestion">
            <div className="error-suggestion-title">💡 Suggestion</div>
            <p className="error-suggestion-text">{error.suggestion}</p>
          </div>
        )}

        <div className="error-query">
          <div className="error-query-label">Query:</div>
          <pre>{error.query}</pre>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
