import React from 'react';
import { Save, X, Eye } from 'lucide-react';

export default function UserModeToolbar({ templateName, onSave, onExit, isSaving, hasChanges }) {
    return (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Eye size={20} className="text-blue-200" />
                    <div>
                        <h2 className="text-white font-semibold text-sm">Template Editor</h2>
                        <p className="text-blue-200 text-xs">{templateName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <span className="text-blue-200 text-xs bg-blue-800/50 px-2 py-1 rounded">
                            Unsaved changes
                        </span>
                    )}

                    <button
                        onClick={onSave}
                        disabled={isSaving || !hasChanges}
                        className={`flex items-center gap-2 px-4 py-2 rounded font-medium text-sm transition-all ${isSaving || !hasChanges
                            ? 'bg-blue-800/50 text-blue-300 cursor-not-allowed'
                            : 'bg-white text-blue-700 hover:bg-blue-50 shadow-lg'
                            }`}
                    >
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button
                        onClick={onExit}
                        className="flex items-center gap-2 px-4 py-2 rounded font-medium text-sm bg-blue-800/50 text-white hover:bg-blue-800 transition"
                    >
                        <X size={16} />
                        Exit
                    </button>
                </div>
            </div>
        </div>
    );
}
