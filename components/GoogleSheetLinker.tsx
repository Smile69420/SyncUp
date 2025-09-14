import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { googleApiService } from '../services/googleApiService';

interface GoogleSheetLinkerProps {
    onClose: () => void;
    onLink: (sheet: { sheetId: string; sheetName: string }) => void;
}

type Sheet = {
    id: string;
    name: string;
}

const GoogleSheetLinker: React.FC<GoogleSheetLinkerProps> = ({ onClose, onLink }) => {
    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
    const [existingSheets, setExistingSheets] = useState<Sheet[]>([]);
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    const [newSheetName, setNewSheetName] = useState('');
    const [loading, setLoading] = useState<'sheets' | 'create' | false>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSheets = async () => {
            if (!googleApiService.getIsSignedIn()) {
                setError('You must be connected to Google to link a sheet.');
                return;
            }
            setLoading('sheets');
            setError(null);
            try {
                const sheets = await googleApiService.getSpreadsheets();
                setExistingSheets(sheets);
            } catch (err: any) {
                setError(`Failed to load spreadsheets: ${err.message || 'Please try again.'}`);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSheets();
    }, []);

    const handleLinkExisting = () => {
        if (!selectedSheetId) return;
        const selectedSheet = existingSheets.find(s => s.id === selectedSheetId);
        if (selectedSheet) {
            onLink({ sheetId: selectedSheet.id, sheetName: selectedSheet.name });
        }
    };
    
    const handleCreateAndLink = async () => {
        if (!newSheetName.trim()) {
            setError('Please enter a name for the new spreadsheet.');
            return;
        }
        setLoading('create');
        setError(null);
        try {
            const newSheet = await googleApiService.createSpreadsheet(newSheetName);
            onLink({ sheetId: newSheet.id, sheetName: newSheet.name });
        } catch (err: any) {
            setError(`Failed to create spreadsheet: ${err.message || 'Please try again.'}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ tab, children }: { tab: typeof activeTab, children: React.ReactNode }) => (
         <button 
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm w-full font-medium rounded-md ${activeTab === tab ? 'bg-primary text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
        >
            {children}
        </button>
    );

    return (
        <Modal title="Link a Google Sheet" onClose={onClose}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                    <TabButton tab="existing">Use Existing</TabButton>
                    <TabButton tab="new">Create New</TabButton>
                </div>
                {error && <p className="text-sm text-center text-red-600 bg-red-50 p-2 rounded-md">{error}</p>}
                <div className="min-h-[250px] flex flex-col">
                    {activeTab === 'existing' && (
                        loading === 'sheets' ? (
                            <div className="flex-grow flex items-center justify-center">
                                <Spinner />
                            </div>
                        ) : (
                            <div className="flex flex-col flex-grow">
                                <div className="space-y-2 flex-grow overflow-y-auto border rounded-md p-2 bg-slate-50 custom-scrollbar">
                                    {existingSheets.length > 0 ? existingSheets.map(sheet => (
                                        <label
                                            key={sheet.id}
                                            className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${selectedSheetId === sheet.id ? 'bg-primary/10 border-primary border' : 'bg-white hover:bg-slate-100'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="sheet"
                                                value={sheet.id}
                                                checked={selectedSheetId === sheet.id}
                                                onChange={() => setSelectedSheetId(sheet.id)}
                                                className="h-4 w-4 text-primary focus:ring-primary border-slate-300"
                                            />
                                            <span className="ml-3 font-medium text-slate-800">{sheet.name}</span>
                                        </label>
                                    )) : <p className="text-center text-slate-500 p-4">No spreadsheets found.</p>}
                                </div>
                                <Button onClick={handleLinkExisting} disabled={!selectedSheetId} className="mt-4 w-full">
                                    Link Selected Sheet
                                </Button>
                            </div>
                        )
                    )}
                    {activeTab === 'new' && (
                        <div className="space-y-4 pt-4">
                            <label className="block text-sm font-medium text-slate-700">New spreadsheet name:</label>
                             <input
                                type="text"
                                value={newSheetName}
                                onChange={e => setNewSheetName(e.target.value)}
                                placeholder="e.g., Event Bookings"
                                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900"
                            />
                            <Button onClick={handleCreateAndLink} disabled={loading === 'create'} className="w-full">
                                {loading === 'create' ? <Spinner size="sm" /> : 'Create and Link Sheet'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default GoogleSheetLinker;