
import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-card text-card-foreground p-6 rounded-lg shadow-md transition-shadow hover:shadow-lg ${className}`}>
            {children}
        </div>
    );
};

export default Card;