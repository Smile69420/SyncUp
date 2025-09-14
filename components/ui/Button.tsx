
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'outline';
    size?: 'sm' | 'md';
}

const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', size = 'md', ...props }) => {
    const baseClasses = "inline-flex items-center justify-center border rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
    
    const variantClasses = {
        primary: "border-transparent bg-primary text-white hover:bg-primary/90",
        outline: "border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50",
    };

    const sizeClasses = {
        sm: "px-2.5 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
    };

    return (
        <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
            {children}
        </button>
    );
};

export default Button;