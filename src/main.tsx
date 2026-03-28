import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { PrinterProvider } from './context/PrinterContext.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import { App } from './App.tsx';
import 'mana-font/css/mana.min.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SettingsProvider>
        <PrinterProvider>
          <App />
        </PrinterProvider>
      </SettingsProvider>
    </HashRouter>
  </StrictMode>,
);
