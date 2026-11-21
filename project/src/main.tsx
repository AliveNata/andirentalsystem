import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { installSessionGuard } from './lib/sessionGuard';
import { TOAST_DURATION } from './lib/notify';
import { loadDynamicFavicon } from './lib/webConfig';

// Must run before the first render so the initial page requests are covered.
installSessionGuard();

// Not awaited: the app renders with the static icons and swaps them if a favicon is set.
void loadDynamicFavicon();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      {/* Radix hides everything outside an open dialog from screen readers except [aria-live] nodes;
          this wrapper keeps toasts audible. "off" because each toast already announces itself. */}
      <div aria-live="off">
        <Toaster
          position="top-right"
          reverseOrder={false}
          toastOptions={{
            success: { duration: TOAST_DURATION.success },
            error: { duration: TOAST_DURATION.error },
          }}
        />
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
