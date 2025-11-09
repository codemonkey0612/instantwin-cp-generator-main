
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', color }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  const style = color ? { borderTopColor: color } : {};

  return (
    <div
      className={`animate-spin rounded-full border-slate-200 ${!color ? 'border-t-slate-800' : ''} ${sizeClasses[size]} ${className}`}
      style={style}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">読み込み中...</span>
    </div>
  );
};

export default Spinner;