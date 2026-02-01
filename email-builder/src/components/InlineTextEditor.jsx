import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

export default function InlineTextEditor({
    selectedComponent,
    initialContent,
    bounds,
    onSave,
    onCancel
}) {
    const [content, setContent] = useState(initialContent || '');
    const textareaRef = useRef(null);

    useEffect(() => {
        setContent(initialContent || '');
    }, [initialContent]);

    useEffect(() => {
        // Auto-focus and select all text when editor opens
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, []);

    const handleSave = () => {
        if (content.trim()) {
            onSave(content);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    if (!selectedComponent || !bounds) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={onCancel}
            />

            {/* Editor */}
            <div
                className="fixed z-50 bg-white rounded-lg shadow-2xl border-2 border-blue-500 animate-in fade-in zoom-in-95"
                style={{
                    top: `${bounds.top}px`,
                    left: `${bounds.left}px`,
                    width: `${Math.max(bounds.width, 300)}px`,
                    minWidth: '300px'
                }}
            >
                <div className="p-3">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                        Edit Content
                    </label>
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-y min-h-[80px]"
                        placeholder="Enter text content..."
                    />
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                            Press Enter to save, Esc to cancel
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={onCancel}
                                className="flex items-center gap-1 px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded text-sm font-medium transition"
                            >
                                <X size={14} />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!content.trim()}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition ${content.trim()
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <Check size={14} />
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
