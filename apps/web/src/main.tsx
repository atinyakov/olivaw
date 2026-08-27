import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { FleetClient } from './fleet-client.js';

const apiUrl = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';
const client = new FleetClient(apiUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>,
);
