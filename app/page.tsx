'use client';

import dynamic from 'next/dynamic';

// Lazy load TruckLoadingMode for better performance
const TruckLoadingMode = dynamic(() => import('@/components/TruckLoadingMode'), {
  ssr: false // TruckLoadingMode is client-side only
});

export default function Home() {
  return (
    <TruckLoadingMode />
  );
}
