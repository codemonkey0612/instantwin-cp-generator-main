import React from 'react';

const GiftTopIcon: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a2.25 2.25 0 0 1-2.25 2.25H5.25a2.25 2.25 0 0 1-2.25-2.25v-8.25M12 15v6M3 11.25l9-9 9 9M3.75 11.25h16.5c.621 0 1.125-.504 1.125-1.125V6.75c0-.621-.504-1.125-1.125-1.125H3.75c-.621 0-1.125.504-1.125 1.125v3.375c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
);

export default GiftTopIcon;
