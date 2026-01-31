import React, { useState, useEffect, useRef } from 'react';
import mjml2html from 'mjml-browser';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';
import {
    Save,
    Plus,
    Trash2,
    FileText,
    ChevronDown,
    Palette,
    AlertCircle,
    Pencil,
    Check,
    X,
    Loader2
} from 'lucide-react';
import Toast from './Toast';

// PRESET BRANDS
const PRESET_BRANDS = {
    default: '',
    dark: `
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text color="#ffffff" />
      <mj-section background-color="#1a202c" />
      <mj-body background-color="#000000" />
    </mj-attributes>
  `,
    simple: `
    <mj-attributes>
      <mj-all font-family="Georgia, serif" />
      <mj-text color="#2d3748" />
      <mj-button background-color="#4c51bf" color="white" border-radius="20px" />
      <mj-section background-color="#ebf8ff" />
    </mj-attributes>
  `
};

const DEFAULT_CODE = `
<mj-section>
  <mj-column>
    <mj-text font-size="20px">Hello World</mj-text>
    <mj-button>Click Me</mj-button>
  </mj-column>
</mj-section>
`;

export default function EmailBuilder() {
    // State
    const [code, setCode] = useState(DEFAULT_CODE);
    const [preview, setPreview] = useState('');
    const [selectedBrand, setSelectedBrand] = useState('default');
    const [isSaving, setIsSaving] = useState(false);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [compileErrors, setCompileErrors] = useState([]);
    const [savedBrandNames, setSavedBrandNames] = useState([]);
    const [savedBrandsFull, setSavedBrandsFull] = useState([]);
    const [savedTemplates, setSavedTemplates] = useState([]);

    // Current template being edited
    const [currentTemplateId, setCurrentTemplateId] = useState(null);
    const [currentTemplateName, setCurrentTemplateName] = useState('New Template');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Inline rename state
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [editingTemplateName, setEditingTemplateName] = useState('');

    // Cloudinary state
    const [activeImageIndex, setActiveImageIndex] = useState(null);

    // Toast & Auto-save state
    const [toast, setToast] = useState({ message: '', type: 'info' });
    const autoSaveTimerRef = useRef(null);

    // Refs
    const editorRef = useRef(null);
    const originalCodeRef = useRef(DEFAULT_CODE);
    const cloudinaryRef = useRef();
    const widgetRef = useRef();
    const activeIndexRef = useRef(null);

    // Keep activeIndexRef in sync for the widget callback
    useEffect(() => {
        activeIndexRef.current = activeImageIndex;
    }, [activeImageIndex]);

    // Track unsaved changes and auto-save
    useEffect(() => {
        setHasUnsavedChanges(code !== originalCodeRef.current);

        // Auto-save logic - only if no compile errors
        if (code !== originalCodeRef.current && currentTemplateId && compileErrors.length === 0) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
                // Double-check no errors at save time
                if (compileErrors.length === 0) {
                    handleSave(true); // true = isAutoSave
                }
            }, 3000); // 3 second debounce
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, currentTemplateId, compileErrors.length]);

    // Load custom brands on mount
    useEffect(() => {
        const fetchBrands = async () => {
            const { data } = await supabase.from('brands').select('*');
            if (data) {
                const mapped = data.map(t => ({
                    id: t.id,
                    name: t.name,
                    fontFamily: t.font_family,
                    textColor: t.text_color,
                    backgroundColor: t.background_color,
                    accentColor: t.accent_color
                }));
                setSavedBrandsFull(mapped);
                setSavedBrandNames(mapped.map(t => t.name));
            }
        };
        fetchBrands();
    }, []);

    // Load template from URL on mount
    useEffect(() => {
        const loadFromUrl = async () => {
            const params = new URLSearchParams(window.location.search);
            const templateId = params.get('template');
            const brandId = params.get('brand');

            if (brandId) {
                setSelectedBrand(brandId);
            }

            if (templateId) {
                const { data } = await supabase
                    .from('templates')
                    .select('*')
                    .eq('id', templateId)
                    .single();

                if (data) {
                    setCode(data.mjml_code);
                    setCurrentTemplateId(data.id);
                    setCurrentTemplateName(data.name);
                    originalCodeRef.current = data.mjml_code;
                    if (data.brand_id) {
                        setSelectedBrand(data.brand_id);
                    }
                }
            }
        };

        loadFromUrl();
    }, []);

    // Update URL when brand changes (for non-template brand switches)
    useEffect(() => {
        if (!currentTemplateId) {
            const url = new URL(window.location);
            if (selectedBrand && selectedBrand !== 'default') {
                url.searchParams.set('brand', selectedBrand);
            } else {
                url.searchParams.delete('brand');
            }
            window.history.replaceState({}, '', url);
        }
    }, [selectedBrand, currentTemplateId]);

    // Cloudinary Widget Initialization
    useEffect(() => {
        if (window.cloudinary) {
            cloudinaryRef.current = window.cloudinary;
            widgetRef.current = cloudinaryRef.current.createUploadWidget({
                cloudName: 'makingthings',
                uploadPreset: 'astro-uploads',
                sources: ['local', 'url', 'camera'],
                multiple: false
            }, (error, result) => {
                if (!error && result && result.event === "success") {
                    const url = result.info.secure_url;
                    handleImageUploaded(url);
                }
            });
        }

        const handleMessage = (event) => {
            if (event.data.type === 'IMAGE_CLICKED') {
                setActiveImageIndex(event.data.index);
                if (widgetRef.current) widgetRef.current.open();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleImageUploaded = (url) => {
        const index = activeIndexRef.current;
        if (index === null) return;

        setCode(prevCode => {
            let count = 0;
            // Robust regex to find nth <mj-image> and replace its src
            const newCode = prevCode.replace(/<mj-image[^>]*src="([^"]*)"[^>]*>/g, (match, p1) => {
                if (count === index) {
                    count++;
                    return match.replace(`src="${p1}"`, `src="${url}"`);
                }
                count++;
                return match;
            });
            return newCode;
        });
    };

    // Fetch templates when brand changes + Realtime subscription
    useEffect(() => {
        const fetchTemplates = async () => {
            const customBrand = savedBrandsFull.find(b => b.id === selectedBrand);
            let query = supabase.from('templates').select('*').order('created_at', { ascending: false });

            if (customBrand) {
                query = query.eq('brand_id', customBrand.id);
            } else {
                query = query.is('brand_id', null);
            }

            const { data } = await query;
            setSavedTemplates(data || []);
        };

        fetchTemplates();

        const channel = supabase
            .channel('templates-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'templates' },
                () => fetchTemplates()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedBrand, savedBrandsFull]);

    // MJML Compiler
    useEffect(() => {
        try {
            let brandMjml = PRESET_BRANDS[selectedBrand] || '';

            if (!PRESET_BRANDS[selectedBrand]) {
                const custom = savedBrandsFull.find(t => t.id === selectedBrand);
                if (custom) {
                    brandMjml = `
                    <mj-attributes>
                        <mj-all font-family="${custom.fontFamily}" />
                        <mj-text color="${custom.textColor}" />
                        <mj-body background-color="${custom.backgroundColor}" />
                        <mj-button background-color="${custom.accentColor}" color="#ffffff" />
                        <mj-section background-color="#ffffff" />
                    </mj-attributes>
                    `;
                }
            }

            const finalMjml = `
        <mjml>
          <mj-head>
            <mj-preview>Email Preview</mj-preview>
            ${brandMjml}
          </mj-head>
          <mj-body>
            ${code}
          </mj-body>
        </mjml>
      `;

            const { html, errors } = mjml2html(finalMjml, { validationLevel: 'soft' });

            // Inject click script for images
            const injectedHtml = html.replace('</body>', `
                <script>
                    document.querySelectorAll('img').forEach((img, index) => {
                        img.style.cursor = 'pointer';
                        img.title = 'Click to replace image';
                        img.onclick = (e) => {
                            e.preventDefault();
                            window.parent.postMessage({ type: 'IMAGE_CLICKED', index }, '*');
                        };
                    });
                </script>
            </body>`);

            setCompileErrors(errors.length > 0 ? errors : []);
            setPreview(injectedHtml);
        } catch (e) {
            console.error("Compilation Error:", e);
        }
    }, [code, selectedBrand, savedBrandsFull]);

    // HANDLERS
    const handleNewTemplate = () => {
        if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
        setCode(DEFAULT_CODE);
        setCurrentTemplateId(null);
        setCurrentTemplateName('New Template');
        originalCodeRef.current = DEFAULT_CODE;

        // Update URL
        const url = new URL(window.location);
        url.searchParams.delete('template');
        window.history.pushState({}, '', url);
    };

    const handleLoadTemplate = (template) => {
        if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;

        // Sync Brand selection with template's brand
        if (template.brand_id) {
            setSelectedBrand(template.brand_id);
        } else {
            setSelectedBrand('default');
        }

        setCode(template.mjml_code);
        setCurrentTemplateId(template.id);
        setCurrentTemplateName(template.name);
        originalCodeRef.current = template.mjml_code;

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('template', template.id);
        if (template.brand_id) {
            url.searchParams.set('brand', template.brand_id);
        } else {
            url.searchParams.delete('brand');
        }
        window.history.pushState({}, '', url);
    };

    const handleSave = async (isAutoSave = false) => {
        // Clear auto-save timer if manual save is triggered
        if (!isAutoSave && autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        setIsSaving(true);
        if (isAutoSave) {
            setIsAutoSaving(true);
        }

        try {
            const isPreset = !!PRESET_BRANDS[selectedBrand];
            const brandId = isPreset ? null : selectedBrand;

            if (currentTemplateId) {
                // Update existing
                const { error } = await supabase
                    .from('templates')
                    .update({
                        mjml_code: code,
                        brand_id: brandId
                    })
                    .eq('id', currentTemplateId);
                if (error) throw error;

                // Update local list state immediately to avoid race condition with Realtime
                setSavedTemplates(prev => prev.map(t =>
                    t.id === currentTemplateId ? { ...t, mjml_code: code, brand_id: brandId } : t
                ));
            } else {
                // Auto-save shouldn't prompt for a name if it's a new template
                if (isAutoSave) {
                    setIsSaving(false);
                    setIsAutoSaving(false);
                    return;
                }

                // Create new
                const name = prompt('Template name:', 'Untitled Template') || 'Untitled Template';
                const { data, error } = await supabase
                    .from('templates')
                    .insert([{ mjml_code: code, brand_id: brandId, name }])
                    .select()
                    .single();
                if (error) throw error;
                setCurrentTemplateId(data.id);
                setCurrentTemplateName(data.name);

                // Update URL for new template
                const url = new URL(window.location);
                url.searchParams.set('template', data.id);
                if (brandId) {
                    url.searchParams.set('brand', brandId);
                } else {
                    url.searchParams.delete('brand');
                }
                window.history.pushState({}, '', url);
            }

            originalCodeRef.current = code;
            setHasUnsavedChanges(false);

            // Show appropriate toast message
            if (isAutoSave) {
                setToast({ message: 'Auto-saved', type: 'info' });
            } else {
                setToast({ message: 'Template saved!', type: 'success' });
            }
        } catch (error) {
            console.error('Save error:', error);
            if (!isAutoSave) {
                setToast({ message: 'Error saving: ' + error.message, type: 'error' });
            } else {
                setToast({ message: 'Auto-save failed', type: 'error' });
            }
        } finally {
            setIsSaving(false);
            if (isAutoSave) {
                setIsAutoSaving(false);
            }
        }
    };

    const handleDeleteTemplate = async (templateId, e) => {
        e.stopPropagation();
        if (!confirm('Delete this template?')) return;

        try {
            const { error } = await supabase.from('templates').delete().eq('id', templateId);
            if (error) throw error;
            if (currentTemplateId === templateId) handleNewTemplate();
        } catch (error) {
            alert('Error deleting: ' + error.message);
        }
    };

    const handleStartRename = (template, e) => {
        e.stopPropagation();
        setEditingTemplateId(template.id);
        setEditingTemplateName(template.name);
    };

    const handleSaveRename = async (templateId) => {
        if (!editingTemplateName.trim()) {
            setEditingTemplateId(null);
            return;
        }

        try {
            const { error } = await supabase
                .from('templates')
                .update({ name: editingTemplateName.trim() })
                .eq('id', templateId);

            if (error) throw error;

            // Update current template name if we're renaming the active one
            if (currentTemplateId === templateId) {
                setCurrentTemplateName(editingTemplateName.trim());
            }
        } catch (error) {
            alert('Error renaming: ' + error.message);
        } finally {
            setEditingTemplateId(null);
        }
    };

    // RENDER
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">

            {/* HEADER */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold text-white">MJML Builder</h1>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm text-gray-300 flex items-center gap-2">
                        {currentTemplateName}
                        {isAutoSaving && (
                            <span className="flex items-center gap-1 text-blue-400 text-xs font-medium bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">
                                <Loader2 size={12} className="animate-spin" />
                                Saving...
                            </span>
                        )}
                        {compileErrors.length > 0 && !isAutoSaving && (
                            <span className="flex items-center gap-1 text-red-400 text-xs font-medium bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20 max-w-xs truncate" title={compileErrors.map(e => e.message).join('; ')}>
                                <AlertCircle size={12} />
                                {compileErrors[0].message}
                            </span>
                        )}
                        {hasUnsavedChanges && !isAutoSaving && compileErrors.length === 0 && (
                            <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                Unsaved
                            </span>
                        )}
                    </span>

                    {/* Save Button relocated here */}
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving || compileErrors.length > 0}
                        className={`flex items-center gap-2 ml-2 px-3 py-1 rounded font-medium text-xs transition-all ${isSaving
                            ? 'bg-green-800/50 text-green-300 cursor-wait'
                            : compileErrors.length > 0
                                ? 'bg-red-800/50 text-red-300 cursor-not-allowed'
                                : hasUnsavedChanges
                                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 animate-pulse'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                        title={compileErrors.length > 0 ? 'Fix MJML errors before saving' : ''}
                    >
                        {isSaving ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : compileErrors.length > 0 ? (
                            <AlertCircle size={12} />
                        ) : (
                            <Save size={12} />
                        )}
                        {isSaving ? 'Saving...' : compileErrors.length > 0 ? 'Has Errors' : 'Save'}
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {/* Brand Selector */}
                    <div className="flex items-center gap-2 bg-gray-700 rounded px-3 py-1.5">
                        <Palette size={16} className="text-gray-400" />
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="bg-transparent text-white text-sm outline-none cursor-pointer"
                        >
                            <option value="default">Default</option>
                            <option value="dark">Dark</option>
                            <option value="simple">Simple</option>
                            {savedBrandsFull.length > 0 && (
                                <optgroup label="Custom Brands">
                                    {savedBrandsFull.map(brand => (
                                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT SIDEBAR - Templates */}
                <aside className="w-56 border-r border-gray-700 bg-gray-850 flex flex-col">
                    <div className="p-3 border-b border-gray-700">
                        <button
                            onClick={handleNewTemplate}
                            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded transition"
                        >
                            <Plus size={16} />
                            New Template
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide px-2 mb-2">
                            Templates ({savedTemplates.length})
                        </p>

                        {savedTemplates.length === 0 ? (
                            <p className="text-gray-500 text-sm px-2">No templates yet</p>
                        ) : (
                            <ul className="space-y-1">
                                {savedTemplates.map((template) => (
                                    <li
                                        key={template.id}
                                        onClick={() => {
                                            if (editingTemplateId !== template.id && currentTemplateId !== template.id) {
                                                handleLoadTemplate(template);
                                            }
                                        }}
                                        className={`group flex items-center justify-between px-2 py-2 rounded cursor-pointer transition ${currentTemplateId === template.id
                                            ? 'bg-blue-600/30 border-l-2 border-blue-500'
                                            : 'hover:bg-gray-700'
                                            }`}
                                    >
                                        {editingTemplateId === template.id ? (
                                            // Inline edit mode
                                            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="text"
                                                    value={editingTemplateName}
                                                    onChange={(e) => setEditingTemplateName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveRename(template.id);
                                                        if (e.key === 'Escape') setEditingTemplateId(null);
                                                    }}
                                                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveRename(template.id)}
                                                    className="p-1 text-green-400 hover:text-green-300"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingTemplateId(null)}
                                                    className="p-1 text-gray-400 hover:text-gray-300"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            // Normal display mode
                                            <>
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                                                    <span className="text-sm truncate">{template.name}</span>
                                                </div>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition">
                                                    <button
                                                        onClick={(e) => handleStartRename(template, e)}
                                                        className="p-1 text-blue-400 hover:text-blue-300"
                                                        title="Rename"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                                                        className="p-1 text-red-400 hover:text-red-300"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-700">
                        <a
                            href="/brands"
                            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
                        >
                            <Palette size={14} />
                            Manage Brands
                        </a>
                    </div>
                </aside >

                {/* CENTER - Code Editor */}
                < div className="flex-1 border-r border-gray-700" >
                    <Editor
                        height="100%"
                        defaultLanguage="xml"
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        onMount={(editor, monaco) => {
                            editorRef.current = editor;

                            const mjmlTags = [
                                { label: 'mj-section', insertText: '<mj-section>\n  <mj-column>\n    $0\n  </mj-column>\n</mj-section>', detail: 'Section' },
                                { label: 'mj-column', insertText: '<mj-column>\n  $0\n</mj-column>', detail: 'Column' },
                                { label: 'mj-text', insertText: '<mj-text font-size="16px">$0</mj-text>', detail: 'Text' },
                                { label: 'mj-image', insertText: '<mj-image src="https://placehold.co/600x400" alt="" />', detail: 'Image' },
                                { label: 'mj-button', insertText: '<mj-button href="#">$0</mj-button>', detail: 'Button' },
                                { label: 'mj-divider', insertText: '<mj-divider border-color="#F45E43" />', detail: 'Divider' },
                                { label: 'mj-spacer', insertText: '<mj-spacer height="20px" />', detail: 'Spacer' }
                            ];

                            monaco.languages.registerCompletionItemProvider('xml', {
                                provideCompletionItems: (model, position) => ({
                                    suggestions: mjmlTags.map(tag => ({
                                        label: tag.label,
                                        kind: monaco.languages.CompletionItemKind.Snippet,
                                        insertText: tag.insertText,
                                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                        documentation: tag.detail,
                                        range: {
                                            startLineNumber: position.lineNumber,
                                            startColumn: position.column - 1,
                                            endLineNumber: position.lineNumber,
                                            endColumn: position.column
                                        }
                                    }))
                                })
                            });
                        }}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true
                        }}
                    />
                </div >

                {/* RIGHT - Preview */}
                < div className="flex-1 bg-gray-100 relative" >
                    <div className="absolute top-2 left-2 bg-white/90 text-gray-600 text-xs px-2 py-1 rounded shadow z-10">
                        Preview
                    </div>

                    {
                        compileErrors.length > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-red-100 text-red-800 p-2 text-xs max-h-24 overflow-y-auto z-20 border-t border-red-200">
                                <div className="flex items-center gap-1 font-medium mb-1">
                                    <AlertCircle size={12} />
                                    Validation Errors
                                </div>
                                <ul className="list-disc pl-4">
                                    {compileErrors.map((err, i) => (
                                        <li key={i}>{err.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )
                    }

                    <iframe
                        title="Preview"
                        srcDoc={preview}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts"
                    />
                </div >
            </div >

            <Toast
                message={toast.message}
                type={toast.type}
                onDismiss={() => setToast({ message: '', type: 'info' })}
            />
        </div >
    );
}