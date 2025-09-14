
import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-16 h-16',
    };
    return (
        <div 
            className={`animate-spin rounded-full border-t-2 border-b-2 border-primary ${sizeClasses[size]}`}
            role="status"
            aria-live="polite"
        >
          <span className="sr-only">Loading...</span>
        </div>
    );
};

export default Spinner;
