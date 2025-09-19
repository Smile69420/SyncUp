
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
    children: React.ReactNode;
    onClose: () => void;
    title: string;
    size?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, title, size = '2xl' }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    const sizeClasses = {
        'md': 'max-w-md',
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl'
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in" onClick={onClose}>
            <div 
                className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-scale-in`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-lg z-10 flex-shrink-0">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;