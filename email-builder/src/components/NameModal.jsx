import React, { useState, useEffect, useRef } from 'react';

export default function NameModal({ open, title, defaultValue = 'Untitled Template', confirmLabel = 'Save', onConfirm, onCancel }) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setValue(defaultValue);
            // Focus input after render
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open, defaultValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = value.trim();
        onConfirm(trimmed || defaultValue);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
            <form
                className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-800 shadow-xl p-4"
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
            >
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && onCancel()}
                    className="w-full mb-6 px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    placeholder="Template name"
                />
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded font-medium text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 rounded font-medium text-sm bg-blue-600 hover:bg-blue-500 text-white transition"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </div>
    );
}
