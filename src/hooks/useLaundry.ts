import { useContext } from 'react';
import { LaundryContext } from '@/contexts/LaundryContextValue';

export const useLaundry = () => {
  const context = useContext(LaundryContext);
  if (context === undefined) {
    throw new Error('useLaundry must be used within a LaundryProvider');
  }
  return context;
};
