import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import { seedIfNeeded } from '@devsage/local-data';
import { AuthProvider } from '@/contexts/auth-context';
import App from './App';
import './index.css';

seedIfNeeded().catch((error) => console.error('Local data seed failed', error));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster position="top-right" theme="dark" />
    </AuthProvider>
  </React.StrictMode>
);
