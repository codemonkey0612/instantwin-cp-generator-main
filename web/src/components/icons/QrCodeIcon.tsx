import React from 'react';

const QrCodeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V7.5a3 3 0 0 0-3-3H3.75Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 4.5a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-1.5m-3-3h3V15m-3-3h3V9m-3-3h3V3" />
    </svg>
);

export default QrCodeIcon;
