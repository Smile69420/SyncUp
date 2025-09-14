import React, { useState } from 'react';
import type { ColumnConfiguration, ColumnConfig } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface ColumnManagerModalProps {
    initialConfig: ColumnConfiguration;
    onClose: () => void;
    onSave: (newConfig: ColumnConfiguration) => void;
}

const ColumnManagerModal: React.FC<ColumnManagerModalProps> = ({ initialConfig, onClose, onSave }) => {
    const [config, setConfig] = useState<ColumnConfiguration>(initialConfig);

    const handleToggleVisibility = (key: ColumnConfig['key']) => {
        setConfig(prevConfig =>
            prevConfig.map(col =>
                col.key === key ? { ...col, isVisible: !col.isVisible } : col
            )
        );
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newConfig = [...config];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex >= 0 && targetIndex < newConfig.length) {
            [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
            setConfig(newConfig);
        }
    };
    
    const handleSave = () => {
        onSave(config);
    };

    return (
        <Modal title="Manage Columns" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Choose which columns to show and change their order. Your preferences will be saved for your next visit.
                </p>
                <div className="border rounded-lg max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <ul className="divide-y divide-slate-200">
                        {config.map((col, index) => (
                            <li key={col.key as string} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`vis-${col.key}`}
                                        checked={col.isVisible}
                                        onChange={() => handleToggleVisibility(col.key)}
                                        className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"
                                    />
                                    <label htmlFor={`vis-${col.key}`} className="ml-3 font-medium text-slate-800">{col.label}</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleMove(index, 'up')} 
                                        disabled={index === 0}
                                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                        aria-label={`Move ${col.label} up`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                    </button>
                                     <button 
                                        onClick={() => handleMove(index, 'down')} 
                                        disabled={index === config.length - 1}
                                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                        aria-label={`Move ${col.label} down`}
                                    >
                                       <path d="m6 9 6 6 6-6"/>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                 <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save View</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ColumnManagerModal;
