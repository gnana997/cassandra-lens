/**
 * Entry point for the Connection Form webview React app.
 *
 * This file is bundled by webpack and loaded in the webview panel.
 * It initializes the React app and renders it into the DOM.
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Get the root element
const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Failed to find root element');
}
