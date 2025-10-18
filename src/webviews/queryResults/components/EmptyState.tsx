/**
 * Empty State component
 *
 * Displayed when no query has been executed yet
 */

const EmptyState = () => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📊</div>
      <h2>No query results yet</h2>
      <p>
        Open a <code>.cql</code> file and press <strong>Ctrl+Enter</strong>{' '}
        (or <strong>Cmd+Enter</strong> on Mac) to execute a query.
      </p>
    </div>
  );
};

export default EmptyState;
