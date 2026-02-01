import React, { useEffect, useState } from 'react';
import { Copy, Trash2, Edit3 } from 'lucide-react';

export default function FloatingToolbar({
    selectedComponent,
    bounds,
    onEdit,
    onDuplicate,
    onDelete
}) {
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!bounds) return;

        // Position toolbar above the selected element
        const toolbarHeight = 40;
        const padding = 8;

        setPosition({
            top: bounds.top - toolbarHeight - padding,
            left: bounds.left
        });
    }, [bounds]);

    if (!selectedComponent) return null;

    return (
        <div
            className="fixed z-50 flex items-center gap-1 bg-blue-600 rounded shadow-2xl p-1 animate-in fade-in slide-in-from-bottom-2"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`
            }}
        >
            <button
                onClick={onEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-white hover:bg-blue-700 rounded text-sm font-medium transition"
                title="Edit content"
            >
                <Edit3 size={14} />
                Edit
            </button>

            <div className="w-px h-5 bg-blue-400" />

            <button
                onClick={onDuplicate}
                className="flex items-center gap-1 px-3 py-1.5 text-white hover:bg-blue-700 rounded text-sm font-medium transition"
                title="Duplicate component"
            >
                <Copy size={14} />
                Duplicate
            </button>

            <div className="w-px h-5 bg-blue-400" />

            <button
                onClick={onDelete}
                className="flex items-center gap-1 px-3 py-1.5 text-white hover:bg-red-600 rounded text-sm font-medium transition"
                title="Delete component"
            >
                <Trash2 size={14} />
                Delete
            </button>
        </div>
    );
}
