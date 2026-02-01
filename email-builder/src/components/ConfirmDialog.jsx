import React from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onConfirm, onCancel }) {
    if (!open) return null;

    const variantStyles = {
        default: 'bg-blue-600 hover:bg-blue-500',
        danger: 'bg-red-600 hover:bg-red-500'
    };
    const btnClass = variantStyles[variant] || variantStyles.default;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
            <div
                className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-800 shadow-xl p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-gray-400 text-sm mb-6">{message}</p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded font-medium text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded font-medium text-sm text-white transition ${btnClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
