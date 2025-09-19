
import React from 'react';

// FIX: Extend React.HTMLAttributes<HTMLDivElement> to allow passing standard div props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        // FIX: Spread the rest of the props to the div element to pass down onClick and other attributes.
        <div className={`bg-card text-card-foreground p-6 rounded-lg shadow-md transition-shadow hover:shadow-lg ${className}`} {...props}>
            {children}
        </div>
    );
};

export default Card;
