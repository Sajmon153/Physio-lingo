import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerPhysioServiceWorker} from './services/pwaOfflineService';

registerPhysioServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
