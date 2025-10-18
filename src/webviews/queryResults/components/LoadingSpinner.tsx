/**
 * Loading Spinner component
 *
 * Displayed while a query is executing
 */

interface LoadingSpinnerProps {
  query: string;
}

const LoadingSpinner = ({ query }: LoadingSpinnerProps) => {
  // Truncate long queries for display
  const displayQuery = query.length > 100 ? query.substring(0, 100) + '...' : query;

  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <div className="loading-query">
        Executing: <code>{displayQuery}</code>
      </div>
    </div>
  );
};

export default LoadingSpinner;
