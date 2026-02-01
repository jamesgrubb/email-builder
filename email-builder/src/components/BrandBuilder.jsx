import React, { useState, useEffect } from 'react';
import mjml2html from 'mjml-browser';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Palette, Pencil, Trash2, Plus, Save } from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';

const DEFAULT_BRAND = {
    name: 'My New Brand',
    fontFamily: 'Arial, sans-serif',
    textColor: '#333333',
    backgroundColor: '#ffffff',
    accentColor: '#007bff',
    primaryColor: '#007bff',
    secondaryColor: '#f8f9fa'
};

export default function BrandBuilder() {
    const [brand, setBrand] = useState(DEFAULT_BRAND);
    const [previewHtml, setPreviewHtml] = useState('');
    const [savedBrands, setSavedBrands] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingBrandId, setEditingBrandId] = useState(null);
    const [toast, setToast] = useState({ message: '', type: 'info' });
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', confirmLabel: 'Delete', variant: 'danger', onConfirm: null });

    // Load saved brands on mount
    useEffect(() => {
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        try {
            const { data, error } = await supabase.from('brands').select('*');
            if (error) throw error;

            const mapped = (data || []).map(t => ({
                id: t.id,
                name: t.name,
                fontFamily: t.font_family,
                textColor: t.text_color,
                backgroundColor: t.background_color,
                accentColor: t.accent_color,
                primaryColor: t.primary_color ?? t.accent_color,
                secondaryColor: t.secondary_color ?? '#6c757d'
            }));
            setSavedBrands(mapped);
        } catch (error) {
            console.error('Error fetching brands:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Generate MJML Preview
    useEffect(() => {
        const primary = brand.primaryColor ?? brand.accentColor;
        const secondary = brand.secondaryColor || '#f8f9fa';
        const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="${brand.fontFamily}" />
            <mj-text color="${brand.textColor}" />
            <mj-body background-color="${brand.backgroundColor}" />
            <mj-button background-color="${primary}" color="#ffffff" />
            <mj-section background-color="${secondary}" />
          </mj-attributes>
          <mj-style inline="inline">
            .brand-primary div { color: ${primary} !important; }
            .brand-secondary div { color: ${secondary} !important; }
            .brand-section { background-color: ${secondary} !important; }
            .brand-hero { background-color: ${primary} !important; }
          </mj-style>
        </mj-head>
        <mj-body>
          <mj-section css-class="brand-hero" padding="24px">
            <mj-column>
              <mj-text css-class="brand-primary" font-size="24px" font-weight="bold">Brand Preview</mj-text>
              <mj-text>
                This is how your text will look. It uses the selected font family and color.
              </mj-text>
              <mj-button>Primary Action</mj-button>
            </mj-column>
          </mj-section>
          <mj-section css-class="brand-section" padding="20px">
            <mj-column>
              <mj-text>Secondary section uses secondary color.</mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

        const { html } = mjml2html(mjml, { validationLevel: 'soft' });
        setPreviewHtml(html);
    }, [brand]);

    const handleSave = async () => {
        try {
            if (editingBrandId) {
                // Update existing brand
                const { error } = await supabase.from('brands').update({
                    name: brand.name,
                    font_family: brand.fontFamily,
                    text_color: brand.textColor,
                    background_color: brand.backgroundColor,
                    accent_color: brand.accentColor,
                    primary_color: brand.primaryColor,
                    secondary_color: brand.secondaryColor
                }).eq('id', editingBrandId);

                if (error) throw error;
                setToast({ message: 'Brand updated', type: 'success' });
                // Stay in edit mode with the updated brand - do not reset
            } else {
                // Create new brand
                const { error } = await supabase.from('brands').insert([{
                    name: brand.name,
                    font_family: brand.fontFamily,
                    text_color: brand.textColor,
                    background_color: brand.backgroundColor,
                    accent_color: brand.accentColor,
                    primary_color: brand.primaryColor,
                    secondary_color: brand.secondaryColor
                }]);

                if (error) throw error;
                setToast({ message: 'Brand saved', type: 'success' });
            }
            fetchBrands();
        } catch (error) {
            setToast({ message: 'Error saving brand: ' + error.message, type: 'error' });
        }
    };

    const handleEditBrand = (brandToEdit) => {
        setBrand(brandToEdit);
        setEditingBrandId(brandToEdit.id);
    };

    const handleDeleteBrand = (brandId) => {
        setConfirmDialog({
            open: true,
            title: 'Delete brand?',
            message: 'This brand will be removed. Templates using it will keep their saved styling.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog((p) => ({ ...p, open: false }));
                try {
                    const { error } = await supabase.from('brands').delete().eq('id', brandId);
                    if (error) throw error;
                    if (editingBrandId === brandId) {
                        setEditingBrandId(null);
                        setBrand(DEFAULT_BRAND);
                    }
                    setToast({ message: 'Brand deleted', type: 'success' });
                    fetchBrands();
                } catch (error) {
                    setToast({ message: 'Error deleting brand: ' + error.message, type: 'error' });
                }
            }
        });
    };

    const handleCancelEdit = () => {
        setEditingBrandId(null);
        setBrand(DEFAULT_BRAND);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
            {/* Header bar */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <Palette size={20} className="text-gray-400" />
                    <h1 className="text-lg font-bold text-white">Brand Builder</h1>
                </div>
                <a
                    href="/"
                    className="flex items-center gap-2 px-3 py-1.5 rounded font-medium text-sm bg-gray-700 hover:bg-gray-600 text-white transition"
                >
                    <ArrowLeft size={16} />
                    Back to Builder
                </a>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Controls */}
                <div className="w-1/3 flex flex-col border-r border-gray-700 overflow-hidden">
                    {/* Saved Brands - top */}
                    <div className="p-4 border-b border-gray-700 shrink-0">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Saved Brands</h3>
                            {editingBrandId && (
                                <button
                                    onClick={handleCancelEdit}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
                                >
                                    <Plus size={12} />
                                    New
                                </button>
                            )}
                        </div>
                        {savedBrands.length === 0 ? (
                            <p className="text-gray-500 text-sm">No saved brands yet.</p>
                        ) : (
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {savedBrands.map((t) => (
                                    <li
                                        key={t.id}
                                        className={`p-2 rounded flex justify-between items-center border-l-2 transition-colors ${
                                            editingBrandId === t.id
                                                ? 'bg-blue-600/20 border-blue-500'
                                                : 'bg-gray-800 border-transparent'
                                        }`}
                                    >
                                        <span className="text-sm truncate flex-1">{t.name}</span>
                                        <div className="flex gap-1 items-center shrink-0">
                                            <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: t.accentColor }} title="Accent" />
                                            <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: t.backgroundColor }} title="Background" />
                                            <button
                                                onClick={() => handleEditBrand(t)}
                                                className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition"
                                                title="Edit brand"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBrand(t.id)}
                                                className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition"
                                                title="Delete brand"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Form */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Brand Name</label>
                        <input
                            type="text"
                            value={brand.name}
                            onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Font Family</label>
                        <select
                            value={brand.fontFamily}
                            onChange={(e) => setBrand({ ...brand, fontFamily: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
                        >
                            <option value="Arial, sans-serif">Arial</option>
                            <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
                            <option value="'Times New Roman', Times, serif">Times New Roman</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="'Courier New', Courier, monospace">Courier New</option>
                            <option value="Verdana, sans-serif">Verdana</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Text Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={brand.textColor}
                                onChange={(e) => setBrand({ ...brand, textColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={brand.textColor}
                                onChange={(e) => setBrand({ ...brand, textColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Background Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={brand.backgroundColor}
                                onChange={(e) => setBrand({ ...brand, backgroundColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={brand.backgroundColor}
                                onChange={(e) => setBrand({ ...brand, backgroundColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Primary Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={brand.primaryColor ?? brand.accentColor}
                                onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={brand.primaryColor ?? brand.accentColor}
                                onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Secondary Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={brand.secondaryColor ?? '#f8f9fa'}
                                onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={brand.secondaryColor ?? '#f8f9fa'}
                                onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Accent Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={brand.accentColor}
                                onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={brand.accentColor}
                                onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded transition"
                        >
                            <Save size={16} />
                            {editingBrandId ? 'Update Brand' : 'Save Brand'}
                        </button>
                        {editingBrandId && (
                            <button
                                onClick={handleCancelEdit}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                    </div>
                </div>

            {/* Preview Pane */}
                <div className="w-2/3 bg-gray-200 flex justify-center items-center p-8 relative">
                    <div className="absolute top-4 left-4 text-gray-800 font-semibold bg-white/80 px-2 py-1 rounded">Live Preview</div>
                    <iframe
                        title="Brand Preview"
                        srcDoc={previewHtml}
                        className="w-full h-full max-w-2xl bg-white shadow-xl rounded-lg"
                        style={{ border: 'none' }}
                    />
                </div>
            </div>

            <Toast
                message={toast.message}
                type={toast.type}
                onDismiss={() => setToast({ message: '', type: 'info' })}
            />

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel={confirmDialog.confirmLabel}
                variant={confirmDialog.variant}
                onConfirm={() => confirmDialog.onConfirm?.()}
                onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
            />
        </div>
    );
}
