import React, { useState, useEffect } from 'react';
import mjml2html from 'mjml-browser';
import { supabase } from '../lib/supabase';

const DEFAULT_BRAND = {
    name: 'My New Brand',
    fontFamily: 'Arial, sans-serif',
    textColor: '#333333',
    backgroundColor: '#ffffff',
    accentColor: '#007bff'
};

export default function BrandBuilder() {
    const [brand, setBrand] = useState(DEFAULT_BRAND);
    const [previewHtml, setPreviewHtml] = useState('');
    const [savedBrands, setSavedBrands] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingBrandId, setEditingBrandId] = useState(null);

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
                accentColor: t.accent_color
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
        const mjml = `
      <mjml>
        <mj-head>
          <mj-attributes>
            <mj-all font-family="${brand.fontFamily}" />
            <mj-text color="${brand.textColor}" />
            <mj-body background-color="${brand.backgroundColor}" />
            <mj-button background-color="${brand.accentColor}" color="#ffffff" />
            <mj-section background-color="#f0f0f0" padding="20px" />
          </mj-attributes>
        </mj-head>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text font-size="24px" font-weight="bold">Brand Preview</mj-text>
              <mj-text>
                This is how your text will look. It uses the selected font family and color.
              </mj-text>
              <mj-button>Primary Action</mj-button>
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
                    accent_color: brand.accentColor
                }).eq('id', editingBrandId);

                if (error) throw error;
                alert('Brand Updated!');
                setEditingBrandId(null);
                setBrand(DEFAULT_BRAND);
            } else {
                // Create new brand
                const { error } = await supabase.from('brands').insert([{
                    name: brand.name,
                    font_family: brand.fontFamily,
                    text_color: brand.textColor,
                    background_color: brand.backgroundColor,
                    accent_color: brand.accentColor
                }]);

                if (error) throw error;
                alert('Brand Saved!');
            }
            fetchBrands();
        } catch (error) {
            alert('Error saving brand: ' + error.message);
        }
    };

    const handleEditBrand = (brandToEdit) => {
        setBrand(brandToEdit);
        setEditingBrandId(brandToEdit.id);
    };

    const handleDeleteBrand = async (brandId) => {
        if (!confirm('Are you sure you want to delete this brand?')) return;

        try {
            const { error } = await supabase.from('brands').delete().eq('id', brandId);
            if (error) throw error;
            fetchBrands();
        } catch (error) {
            alert('Error deleting brand: ' + error.message);
        }
    };

    const handleCancelEdit = () => {
        setEditingBrandId(null);
        setBrand(DEFAULT_BRAND);
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar Controls */}
            <div className="w-1/3 p-6 border-r border-gray-700 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Brand Builder</h2>
                    <a href="/" className="text-sm text-blue-400 hover:underline">← Back to Builder</a>
                </div>

                <div className="space-y-4">
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
                        <label className="block text-sm font-medium mb-1">Accent Color (Buttons)</label>
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
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded mt-4 transition"
                        >
                            {editingBrandId ? 'Update Brand' : 'Save Brand'}
                        </button>
                        {editingBrandId && (
                            <button
                                onClick={handleCancelEdit}
                                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded mt-4 transition"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-8 border-t border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold mb-3">Saved Brands</h3>
                    {savedBrands.length === 0 ? (
                        <p className="text-gray-400 text-sm">No saved brands yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {savedBrands.map((t) => (
                                <li key={t.id} className="bg-gray-800 p-2 rounded flex justify-between items-center">
                                    <span>{t.name}</span>
                                    <div className="flex gap-2 items-center">
                                        <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: t.accentColor }}></div>
                                        <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: t.backgroundColor }}></div>
                                        <button
                                            onClick={() => handleEditBrand(t)}
                                            className="text-blue-400 hover:text-blue-300 ml-2"
                                            title="Edit brand"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBrand(t.id)}
                                            className="text-red-400 hover:text-red-300"
                                            title="Delete brand"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
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
    );
}
