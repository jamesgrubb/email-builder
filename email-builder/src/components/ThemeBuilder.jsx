import React, { useState, useEffect } from 'react';
import mjml2html from 'mjml-browser';
import { supabase } from '../lib/supabase';

const DEFAULT_THEME = {
    name: 'My New Theme',
    fontFamily: 'Arial, sans-serif',
    textColor: '#333333',
    backgroundColor: '#ffffff',
    accentColor: '#007bff'
};

export default function ThemeBuilder() {
    const [theme, setTheme] = useState(DEFAULT_THEME);
    const [previewHtml, setPreviewHtml] = useState('');
    const [savedThemes, setSavedThemes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved themes on mount
    useEffect(() => {
        fetchThemes();
    }, []);

    const fetchThemes = async () => {
        try {
            const { data, error } = await supabase.from('themes').select('*');
            if (error) throw error;
            // Map db columns to state shape if needed, assuming camelCase in DB or mapper
            // For now assuming 1:1 mapping with snake_case keys from DB -> converting to camelCase for app usage logic
            // Actually, the plan assumed snake_case columns. Let's map them.
            const mapped = (data || []).map(t => ({
                id: t.id,
                name: t.name,
                fontFamily: t.font_family,
                textColor: t.text_color,
                backgroundColor: t.background_color,
                accentColor: t.accent_color
            }));
            setSavedThemes(mapped);
        } catch (error) {
            console.error('Error fetching themes:', error);
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
            <mj-all font-family="${theme.fontFamily}" />
            <mj-text color="${theme.textColor}" />
            <mj-body background-color="${theme.backgroundColor}" />
            <mj-button background-color="${theme.accentColor}" color="#ffffff" />
            <mj-section background-color="#f0f0f0" padding="20px" />
          </mj-attributes>
        </mj-head>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text font-size="24px" font-weight="bold">Theme Preview</mj-text>
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
    }, [theme]);

    const handleSave = async () => {
        try {
            const { error } = await supabase.from('themes').insert([{
                name: theme.name,
                font_family: theme.fontFamily,
                text_color: theme.textColor,
                background_color: theme.backgroundColor,
                accent_color: theme.accentColor
            }]);

            if (error) throw error;
            alert('Theme Saved!');
            fetchThemes(); // Refresh list
        } catch (error) {
            alert('Error saving theme: ' + error.message);
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar Controls */}
            <div className="w-1/3 p-6 border-r border-gray-700 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Theme Builder</h2>
                    <a href="/" className="text-sm text-blue-400 hover:underline">← Back to Builder</a>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Theme Name</label>
                        <input
                            type="text"
                            value={theme.name}
                            onChange={(e) => setTheme({ ...theme, name: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Font Family</label>
                        <select
                            value={theme.fontFamily}
                            onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })}
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
                                value={theme.textColor}
                                onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={theme.textColor}
                                onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Background Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={theme.backgroundColor}
                                onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={theme.backgroundColor}
                                onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Accent Color (Buttons)</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={theme.accentColor}
                                onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                                className="h-10 w-10 rounded border-none cursor-pointer"
                            />
                            <input
                                type="text"
                                value={theme.accentColor}
                                onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded mt-4 transition"
                    >
                        Save Theme
                    </button>
                </div>

                <div className="mt-8 border-t border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold mb-3">Saved Themes</h3>
                    {savedThemes.length === 0 ? (
                        <p className="text-gray-400 text-sm">No saved themes yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {savedThemes.map((t, i) => (
                                <li key={i} className="bg-gray-800 p-2 rounded flex justify-between items-center">
                                    <span>{t.name}</span>
                                    <div className="flex gap-2 text-xs">
                                        <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: t.accentColor }}></div>
                                        <div className="w-4 h-4 rounded-full border border-gray-600" style={{ backgroundColor: t.backgroundColor }}></div>
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
                    title="Theme Preview"
                    srcDoc={previewHtml}
                    className="w-full h-full max-w-2xl bg-white shadow-xl rounded-lg"
                    style={{ border: 'none' }}
                />
            </div>
        </div>
    );
}
