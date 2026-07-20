import React from 'react';
import ReactDOM from 'react-dom/client';
import 'animal-island-ui/style'; // ⚠️ 必须在任何组件使用前引入，否则组件无样式
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
