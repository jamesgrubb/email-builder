import React, { useEffect } from 'react';
import { CheckCircle, Info, AlertCircle, X } from 'lucide-react';

const TOAST_TYPES = {
    success: {
        icon: <CheckCircle className="text-green-400" size={18} />,
        bg: 'bg-green-900/90',
        border: 'border-green-800'
    },
    error: {
        icon: <AlertCircle className="text-red-400" size={18} />,
        bg: 'bg-red-900/90',
        border: 'border-red-800'
    },
    info: {
        icon: <Info className="text-blue-400" size={18} />,
        bg: 'bg-blue-900/90',
        border: 'border-blue-800'
    }
};

export default function Toast({ message, type = 'info', onDismiss, duration = 3000 }) {
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => {
            onDismiss();
        }, duration);
        return () => clearTimeout(timer);
    }, [message, duration, onDismiss]);

    if (!message) return null;

    const theme = TOAST_TYPES[type] || TOAST_TYPES.info;

    return (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl z-50 transition-all animate-in fade-in slide-in-from-bottom-4 ${theme.bg} ${theme.border}`}>
            {theme.icon}
            <span className="text-sm font-medium text-white">{message}</span>
            <button
                onClick={onDismiss}
                className="ml-2 p-0.5 hover:bg-white/10 rounded-full transition"
            >
                <X size={14} className="text-gray-400" />
            </button>
        </div>
    );
}
