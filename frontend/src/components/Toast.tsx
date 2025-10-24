import { Toaster } from 'react-hot-toast';

export const Toast = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      style: {
        background: '#111827',
        color: '#e5e7eb',
        border: '1px solid #0ea5e9',
      },
      duration: 4000,
    }}
  />
);