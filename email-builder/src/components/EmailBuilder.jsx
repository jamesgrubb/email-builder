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
    Loader2,
    Eye,
    Undo2
} from 'lucide-react';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';
import NameModal from './NameModal';
import UserModeToolbar from './UserModeToolbar';
import FloatingToolbar from './FloatingToolbar';
import InlineTextEditor from './InlineTextEditor';
import { parseEditableComponents } from '../lib/editableComponentParser';
import { updateEditableContent, duplicateComponent, deleteComponent } from '../lib/mjmlContentUpdater';
import {
    extractEditableMappings,
    injectEditableAttributes,
    ensureEditableClassesInMjml,
    ensureMjClassOnBodyComponents
} from '../lib/injectEditableAttributes';

// Brand color values for mj-style (preset + custom)
const PRESET_BRAND_COLORS = {
    default: { primary: '#007bff', secondary: '#f8f9fa' },
    dark: { primary: '#60a5fa', secondary: '#1a202c' },
    simple: { primary: '#4c51bf', secondary: '#ebf8ff' }
};

function buildBrandStyleMjml(primary, secondary) {
    return `
<mj-style inline="inline">
  .brand-primary div { color: ${primary} !important; }
  .brand-secondary div { color: ${secondary} !important; }
  .brand-section { background-color: ${secondary} !important; }
  .brand-hero { background-color: ${primary} !important; }
</mj-style>
`;
}

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
<mj-section css-class="brand-hero" padding="24px">
  <mj-column>
    <mj-text mj-class="editable-text-1" css-class="brand-primary" font-size="24px" font-weight="bold">Hello World</mj-text>
    <mj-text mj-class="editable-text-2">This uses default brand text color.</mj-text>
    <mj-button mj-class="editable-button-1">Click Me</mj-button>
  </mj-column>
</mj-section>
<mj-section css-class="brand-section">
  <mj-column>
    <mj-text>Secondary section background.</mj-text>
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

    // User Mode state
    const [isUserMode, setIsUserMode] = useState(false);
    const [editableComponents, setEditableComponents] = useState([]);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [selectedComponentBounds, setSelectedComponentBounds] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Undo history
    const [canUndo, setCanUndo] = useState(false);
    const codeHistoryRef = useRef([]);

    // Empty state: hide editor/preview until user starts creating (when no saved templates)
    const [hasStartedCreating, setHasStartedCreating] = useState(false);
    const showEmptyState = !isUserMode && savedTemplates.length === 0 && !hasStartedCreating;

    // Dialogs (replaces alert/confirm/prompt)
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', confirmLabel: 'Confirm', variant: 'default', onConfirm: null });
    const [nameModal, setNameModal] = useState({ open: false, title: '', defaultValue: 'Untitled Template', confirmLabel: 'Save', onConfirm: null, onCancel: null });

    // Refs
    const editorRef = useRef(null);
    const originalCodeRef = useRef(DEFAULT_CODE);
    const cloudinaryRef = useRef();
    const widgetRef = useRef();
    const activeIndexRef = useRef(null);
    const previewIframeRef = useRef(null);

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
                    accentColor: t.accent_color,
                    primaryColor: t.primary_color ?? t.accent_color,
                    secondaryColor: t.secondary_color ?? '#6c757d'
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
                // Validate it's either a preset or a valid UUID
                const isPreset = !!PRESET_BRANDS[brandId];
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (isPreset || uuidRegex.test(brandId)) {
                    setSelectedBrand(brandId);
                } else {
                    console.warn('Invalid brand ID in URL, ignoring:', brandId);
                }
            }

            if (templateId && templateId.trim()) {
                try {
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
                } catch (error) {
                    console.error('Error loading template from URL:', error);
                    // Clear invalid template param from URL
                    const url = new URL(window.location);
                    url.searchParams.delete('template');
                    window.history.replaceState({}, '', url);
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

    // Parse editable components from compiled HTML (for user mode)
    useEffect(() => {
        if (isUserMode && preview) {
            const components = parseEditableComponents(preview);
            setEditableComponents(components);
        } else if (isUserMode && !preview) {
            setEditableComponents([]);
        }
    }, [preview, isUserMode]);

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
            } else if (event.data.type === 'EDITABLE_COMPONENT_CLICKED') {
                // Handle editable component selection - match by index (from injection) for correct lookup
                const idx = event.data.editableIndex;
                const component = (typeof idx === 'number' && idx >= 0 && editableComponents.find(c => c.index === idx)) || editableComponents.find(c => c.id === event.data.editableId);
                if (component) {
                    setSelectedComponent(component);
                    // Convert iframe coordinates to page coordinates for FloatingToolbar/InlineTextEditor
                    const iframeBounds = event.data.bounds;
                    let bounds = iframeBounds;
                    if (previewIframeRef.current) {
                        const iframeRect = previewIframeRef.current.getBoundingClientRect();
                        bounds = {
                            top: iframeRect.top + iframeBounds.top,
                            left: iframeRect.left + iframeBounds.left,
                            width: iframeBounds.width,
                            height: iframeBounds.height
                        };
                    }
                    setSelectedComponentBounds(bounds);
                    setIsEditing(false); // Show toolbar, not editor
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [editableComponents]);

    const handleImageUploaded = (url) => {
        const index = activeIndexRef.current;
        if (index === null) return;

        setToast({ message: 'Image updated successfully', type: 'success' });

        setCode(prevCode => {
            pushCodeToHistory(prevCode);
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
            // Detect if user provided full MJML document or just body content
            const isFullMjml = code.trim().startsWith('<mjml');

            let finalMjml;

            if (isFullMjml) {
                // User provided full MJML document - use as-is
                finalMjml = code;
            } else {
                // User provided body content only - wrap it
                let bodyContent = code;
                if (isUserMode) {
                    const transformed = ensureMjClassOnBodyComponents(code);
                    if (transformed !== code) {
                        bodyContent = transformed;
                        setCode(transformed);
                    }
                }

                let brandMjml = PRESET_BRANDS[selectedBrand] || '';
                let primary = PRESET_BRAND_COLORS.default.primary;
                let secondary = PRESET_BRAND_COLORS.default.secondary;

                if (PRESET_BRAND_COLORS[selectedBrand]) {
                    primary = PRESET_BRAND_COLORS[selectedBrand].primary;
                    secondary = PRESET_BRAND_COLORS[selectedBrand].secondary;
                } else {
                    const custom = savedBrandsFull.find(t => t.id === selectedBrand);
                    if (custom) {
                        primary = custom.primaryColor ?? custom.accentColor;
                        secondary = custom.secondaryColor ?? '#f8f9fa';
                        brandMjml = `
                        <mj-attributes>
                            <mj-all font-family="${custom.fontFamily}" />
                            <mj-text color="${custom.textColor}" />
                            <mj-body background-color="${custom.backgroundColor}" />
                            <mj-button background-color="${primary}" color="#ffffff" />
                            <mj-section background-color="${secondary}" />
                        </mj-attributes>
                        `;
                    }
                }

                const brandStyleMjml = buildBrandStyleMjml(primary, secondary);

                finalMjml = `
            <mjml>
              <mj-head>
                <mj-preview>Email Preview</mj-preview>
                ${brandMjml}
                ${brandStyleMjml}
              </mj-head>
              <mj-body>
                ${bodyContent}
              </mj-body>
            </mjml>
          `;
            }

            // Ensure mj-class="editable-X" produces class="editable-X" in output (mjml-browser requirement)
            const mjmlToCompile = isUserMode ? ensureEditableClassesInMjml(finalMjml) : finalMjml;

            const { html: rawHtml, errors } = mjml2html(mjmlToCompile, { validationLevel: 'soft' });
            let html = rawHtml;

            // Workaround: mjml-browser doesn't support mj-html-attributes, so inject data-editable manually
            if (isUserMode) {
                const mappings = extractEditableMappings(finalMjml);
                html = injectEditableAttributes(html, mappings);
            }

            // Inject click scripts based on mode
            let injectionScript = '';

            if (isUserMode) {
                // User Mode: Make editable components interactive
                injectionScript = `
                <script>
                    // Make editable components interactive
                    document.querySelectorAll('[data-editable="true"]').forEach((el, index) => {
                        const editableId = el.dataset.editableId;
                        if (!editableId) return;

                        el.style.transition = 'outline 0.2s, background-color 0.2s';
                        el.style.cursor = 'pointer';

                        el.addEventListener('mouseenter', () => {
                            el.style.outline = '2px dashed #3b82f6';
                            el.style.outlineOffset = '2px';
                            el.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                        });

                        el.addEventListener('mouseleave', () => {
                            el.style.outline = 'none';
                            el.style.backgroundColor = 'transparent';
                        });

                        el.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const bounds = el.getBoundingClientRect();
                            const idx = el.dataset.editableIndex != null ? parseInt(el.dataset.editableIndex, 10) : index;
                            window.parent.postMessage({
                                type: 'EDITABLE_COMPONENT_CLICKED',
                                editableId: editableId,
                                editableIndex: idx,
                                editableType: el.dataset.editableType || 'text',
                                currentContent: el.textContent,
                                bounds: {
                                    top: bounds.top,
                                    left: bounds.left,
                                    width: bounds.width,
                                    height: bounds.height
                                }
                            }, '*');
                        });
                    });
                </script>
                `;
            } else {
                // Normal Mode: Image replacement functionality
                injectionScript = `
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
                `;
            }

            const injectedHtml = html.replace('</body>', `${injectionScript}</body>`);

            setCompileErrors(errors.length > 0 ? errors : []);
            setPreview(injectedHtml);
        } catch (e) {
            console.error("Compilation Error:", e);
        }
    }, [code, selectedBrand, savedBrandsFull, isUserMode]);

    // HANDLERS
    const pushCodeToHistory = (currentCode) => {
        const stack = codeHistoryRef.current;
        if (stack.length > 0 && stack[stack.length - 1] === currentCode) return;
        if (stack.length >= 50) stack.shift();
        stack.push(currentCode);
        setCanUndo(true);
    };

    const handleUndo = () => {
        const stack = codeHistoryRef.current;
        if (stack.length === 0) return;
        const prevCode = stack.pop();
        setCode(prevCode);
        setCanUndo(stack.length > 0);
        setSelectedComponent(null);
        setToast({ message: 'Changes undone', type: 'info' });
    };

    const doNewTemplate = (opts = {}) => {
        if (savedTemplates.length === 0) setHasStartedCreating(true);
        codeHistoryRef.current = [];
        setCanUndo(false);
        setCode(DEFAULT_CODE);
        setCurrentTemplateId(null);
        setCurrentTemplateName('New Template');
        originalCodeRef.current = DEFAULT_CODE;
        const url = new URL(window.location);
        url.searchParams.delete('template');
        window.history.pushState({}, '', url);
        if (opts.silent !== true) {
            setToast({ message: 'New template started. Name and save it when ready.', type: 'info' });
        }
    };

    const handleFirstTimeCreate = () => {
        setNameModal({
            open: true,
            title: 'Name your first template',
            defaultValue: 'My First Template',
            confirmLabel: 'Create',
            onConfirm: async (name) => {
                setNameModal((p) => ({ ...p, open: false }));
                setHasStartedCreating(true);
                setCode(DEFAULT_CODE);
                codeHistoryRef.current = [];
                setCanUndo(false);
                originalCodeRef.current = DEFAULT_CODE;
                setIsSaving(true);
                try {
                    await doCreateTemplate(name.trim() || 'My First Template', DEFAULT_CODE);
                    setHasUnsavedChanges(false);
                    setToast({ message: 'Template created! Start editing below.', type: 'success' });
                } catch (error) {
                    console.error('Create error:', error);
                    setToast({ message: 'Error creating template: ' + error.message, type: 'error' });
                    doNewTemplate();
                } finally {
                    setIsSaving(false);
                }
            },
            onCancel: () => setNameModal((p) => ({ ...p, open: false }))
        });
    };

    const openNewTemplateNameModal = () => {
        setNameModal({
            open: true,
            title: 'Name your new template',
            defaultValue: 'Untitled Template',
            confirmLabel: 'Create',
            onConfirm: async (name) => {
                setNameModal((p) => ({ ...p, open: false }));
                setCode(DEFAULT_CODE);
                codeHistoryRef.current = [];
                setCanUndo(false);
                originalCodeRef.current = DEFAULT_CODE;
                setIsSaving(true);
                try {
                    await doCreateTemplate(name.trim() || 'Untitled Template', DEFAULT_CODE);
                    setHasUnsavedChanges(false);
                    setToast({ message: 'Template created!', type: 'success' });
                } catch (error) {
                    console.error('Create error:', error);
                    setToast({ message: 'Error creating template: ' + error.message, type: 'error' });
                    doNewTemplate({ silent: true });
                } finally {
                    setIsSaving(false);
                }
            },
            onCancel: () => setNameModal((p) => ({ ...p, open: false }))
        });
    };

    const handleNewTemplate = () => {
        if (hasUnsavedChanges) {
            setConfirmDialog({
                open: true,
                title: 'Discard changes?',
                message: 'You have unsaved changes. Discard them and create a new template?',
                confirmLabel: 'Discard',
                variant: 'danger',
                onConfirm: () => {
                    setConfirmDialog((p) => ({ ...p, open: false }));
                    doNewTemplate({ silent: true });
                    openNewTemplateNameModal();
                }
            });
        } else {
            openNewTemplateNameModal();
        }
    };

    const doLoadTemplate = (template) => {
        codeHistoryRef.current = [];
        setCanUndo(false);
        if (template.brand_id) setSelectedBrand(template.brand_id);
        else setSelectedBrand('default');
        setCode(template.mjml_code);
        setCurrentTemplateId(template.id);
        setCurrentTemplateName(template.name);
        originalCodeRef.current = template.mjml_code;
        const url = new URL(window.location);
        url.searchParams.set('template', template.id);
        if (template.brand_id) url.searchParams.set('brand', template.brand_id);
        else url.searchParams.delete('brand');
        window.history.pushState({}, '', url);
    };

    const handleLoadTemplate = (template) => {
        if (hasUnsavedChanges) {
            setConfirmDialog({
                open: true,
                title: 'Discard changes?',
                message: 'You have unsaved changes. Discard them and load this template?',
                confirmLabel: 'Discard',
                variant: 'danger',
                onConfirm: () => {
                    setConfirmDialog((p) => ({ ...p, open: false }));
                    doLoadTemplate(template);
                }
            });
        } else {
            doLoadTemplate(template);
        }
    };

    const doCreateTemplate = async (name, mjmlCode = code) => {
        const isPreset = !!PRESET_BRANDS[selectedBrand];
        let brandId = isPreset ? null : selectedBrand;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (brandId && !uuidRegex.test(brandId)) brandId = null;

        const { data, error } = await supabase
            .from('templates')
            .insert([{ mjml_code: mjmlCode, brand_id: brandId, name }])
            .select()
            .single();
        if (error) throw error;
        setCurrentTemplateId(data.id);
        setCurrentTemplateName(data.name);
        setSavedTemplates((prev) => [{ ...data, brand_id: brandId }, ...prev]);
        const url = new URL(window.location);
        url.searchParams.set('template', data.id);
        if (brandId) url.searchParams.set('brand', brandId);
        else url.searchParams.delete('brand');
        window.history.pushState({}, '', url);
    };

    const handleSave = async (isAutoSave = false) => {
        if (!isAutoSave && autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        const isPreset = !!PRESET_BRANDS[selectedBrand];
        let brandId = isPreset ? null : selectedBrand;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (brandId && !uuidRegex.test(brandId)) brandId = null;

        if (currentTemplateId) {
            setIsSaving(true);
            if (isAutoSave) setIsAutoSaving(true);
            try {
                const { error } = await supabase
                    .from('templates')
                    .update({ mjml_code: code, brand_id: brandId })
                    .eq('id', currentTemplateId);
                if (error) throw error;
                setSavedTemplates(prev => prev.map(t =>
                    t.id === currentTemplateId ? { ...t, mjml_code: code, brand_id: brandId } : t
                ));
                originalCodeRef.current = code;
                setHasUnsavedChanges(false);
                setToast({ message: isAutoSave ? 'Auto-saved' : 'Template saved!', type: isAutoSave ? 'info' : 'success' });
            } catch (error) {
                console.error('Save error:', error);
                setToast({ message: isAutoSave ? 'Auto-save failed' : 'Error saving: ' + error.message, type: 'error' });
            } finally {
                setIsSaving(false);
                if (isAutoSave) setIsAutoSaving(false);
            }
        } else {
            if (isAutoSave) return;
            setNameModal({
                open: true,
                title: 'Name your template',
                defaultValue: 'Untitled Template',
                confirmLabel: 'Save',
                onConfirm: async (name) => {
                    setNameModal((p) => ({ ...p, open: false }));
                    setIsSaving(true);
                    try {
                        await doCreateTemplate(name.trim() || 'Untitled Template');
                        originalCodeRef.current = code;
                        setHasUnsavedChanges(false);
                        setToast({ message: 'Template saved!', type: 'success' });
                    } catch (error) {
                        console.error('Save error:', error);
                        setToast({ message: 'Error saving: ' + error.message, type: 'error' });
                    } finally {
                        setIsSaving(false);
                    }
                },
                onCancel: () => setNameModal((p) => ({ ...p, open: false }))
            });
        }
    };

    const handleDeleteTemplate = (templateId, e) => {
        e.stopPropagation();
        setConfirmDialog({
            open: true,
            title: 'Delete template?',
            message: 'This template will be removed. You can undo deletions from the editor.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog((p) => ({ ...p, open: false }));
                try {
                    const { error } = await supabase.from('templates').delete().eq('id', templateId);
                    if (error) throw error;
                    setSavedTemplates((prev) => prev.filter((t) => t.id !== templateId));
                    if (savedTemplates.length === 1) setHasStartedCreating(false);
                    if (currentTemplateId === templateId) doNewTemplate({ silent: true });
                } catch (err) {
                    setToast({ message: 'Error deleting: ' + err.message, type: 'error' });
                }
            }
        });
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
            setToast({ message: 'Error renaming: ' + error.message, type: 'error' });
        } finally {
            setEditingTemplateId(null);
        }
    };

    // USER MODE HANDLERS
    const handleEditComponent = () => {
        if (!selectedComponent) return;

        // Images: open Cloudinary widget to replace; text/button: open inline editor
        if (selectedComponent.type === 'image') {
            const match = selectedComponent.id.match(/^image-(\d+)$/);
            const index = match ? parseInt(match[1], 10) - 1 : 0;
            activeIndexRef.current = index;
            setActiveImageIndex(index);
            setSelectedComponent(null);
            if (widgetRef.current) {
                widgetRef.current.open();
            } else {
                setToast({ message: 'Image upload is loading...', type: 'info' });
            }
            return;
        }

        setIsEditing(true);
    };

    const handleDuplicateComponent = () => {
        if (!selectedComponent) return;

        const result = duplicateComponent(code, selectedComponent.id, selectedComponent.content);

        if (result.success) {
            pushCodeToHistory(code);
            setCode(result.mjml);
            setSelectedComponent(null);
            setToast({ message: 'Component duplicated successfully', type: 'success' });
        } else {
            setToast({ message: result.error || 'Failed to duplicate component', type: 'error' });
        }
    };

    const handleDeleteComponent = () => {
        if (!selectedComponent) return;

        const result = deleteComponent(code, selectedComponent.id, selectedComponent.content);

        if (result.success) {
            pushCodeToHistory(code);
            setCode(result.mjml);
            setSelectedComponent(null);
            setToast({ message: 'Component deleted successfully', type: 'success' });
        } else {
            setToast({ message: result.error || 'Failed to delete component', type: 'error' });
        }
    };

    const handleSaveContent = (newContent) => {
        if (!selectedComponent) return;

        const result = updateEditableContent(code, selectedComponent.id, newContent, selectedComponent.content);

        if (result.success) {
            pushCodeToHistory(code);
            setCode(result.mjml);
            setIsEditing(false);
            setSelectedComponent(null);
            setToast({ message: 'Content updated successfully', type: 'success' });
        } else {
            // Show error but keep editor open so user can fix it
            setToast({ message: result.error || 'Failed to update content', type: 'error' });
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    const handleToggleUserMode = () => {
        if (!isUserMode) {
            // Entering User Mode: ensure body components have mj-class for editing
            const transformed = ensureMjClassOnBodyComponents(code);
            if (transformed !== code) {
                setCode(transformed);
            }
        }
        setIsUserMode(!isUserMode);
        setSelectedComponent(null);
        setIsEditing(false);
    };

    const handleUserModeSave = async () => {
        await handleSave(false);
    };

    const handleUserModeExit = () => {
        if (hasUnsavedChanges) {
            setConfirmDialog({
                open: true,
                title: 'Discard changes?',
                message: 'You have unsaved changes. Discard them and exit user mode?',
                confirmLabel: 'Discard',
                variant: 'danger',
                onConfirm: () => {
                    setConfirmDialog((p) => ({ ...p, open: false }));
                    setIsUserMode(false);
                    setSelectedComponent(null);
                }
            });
        } else {
            setIsUserMode(false);
            setSelectedComponent(null);
        }
    };

    // RENDER
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">

            {/* USER MODE TOOLBAR OR NORMAL HEADER */}
            {isUserMode ? (
                <UserModeToolbar
                    templateName={currentTemplateId ? currentTemplateName : 'New template (unsaved)'}
                    onSave={handleUserModeSave}
                    onExit={handleUserModeExit}
                    onUndo={handleUndo}
                    canUndo={canUndo}
                    isSaving={isSaving}
                    hasChanges={hasUnsavedChanges}
                />
            ) : (
                <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold text-white">MJML Builder</h1>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm text-gray-300 flex items-center gap-2">
                        {currentTemplateId ? currentTemplateName : 'New template (unsaved)'}
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

                    {/* Undo button */}
                    <button
                        onClick={handleUndo}
                        disabled={!canUndo}
                        title="Undo last change"
                        className={`gap-2 ml-2 px-3 py-1 rounded font-medium text-xs transition-all flex items-center ${!canUndo ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        <Undo2 size={12} />
                        Undo
                    </button>

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

                    {/* User Mode Toggle */}
                    <button
                        onClick={handleToggleUserMode}
                        className="flex items-center gap-2 px-3 py-1.5 rounded font-medium text-sm bg-blue-600 hover:bg-blue-500 text-white transition"
                        title="Switch to user mode to edit template content"
                    >
                        <Eye size={16} />
                        User Mode
                    </button>
                </div>
                </header>
            )}

            {/* MAIN CONTENT */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT SIDEBAR - Templates (hidden in user mode and when empty) */}
                {!isUserMode && !showEmptyState && (
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
                            <p className="text-gray-500 text-xs px-2 py-4">No templates yet</p>
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
                </aside>
                )}

                {/* CENTER - Code Editor (hidden in user mode and when empty) */}
                {!isUserMode && !showEmptyState && (
                <div className="flex-1 border-r border-gray-700">
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
                </div>
                )}

                {/* Empty state - when no templates and user hasn't started creating */}
                {showEmptyState && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-gray-900/50 px-8">
                        <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center border border-gray-700">
                            <FileText size={40} className="text-gray-500" />
                        </div>
                        <div className="text-center max-w-md">
                            <h2 className="text-xl font-semibold text-white mb-2">Create your first email template</h2>
                            <p className="text-gray-400 text-sm leading-relaxed mb-6">
                                Name your template to get started. You can edit the MJML code and save changes anytime.
                            </p>
                            <button
                                onClick={handleFirstTimeCreate}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/20"
                            >
                                <Plus size={20} />
                                Get started
                            </button>
                        </div>
                        <a
                            href="/brands"
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition"
                        >
                            <Palette size={14} />
                            Manage Brands
                        </a>
                    </div>
                )}

                {/* RIGHT - Preview (hidden when empty state) */}
                {!showEmptyState && (
                <div className="flex-1 bg-gray-100 relative">
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
                        ref={previewIframeRef}
                        title="Preview"
                        srcDoc={preview}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts"
                    />
                </div>
                )}
            </div>

            {/* User Mode - Floating Toolbar */}
            {isUserMode && selectedComponent && !isEditing && (
                <FloatingToolbar
                    selectedComponent={selectedComponent}
                    bounds={selectedComponentBounds}
                    onEdit={handleEditComponent}
                    onDuplicate={handleDuplicateComponent}
                    onDelete={handleDeleteComponent}
                />
            )}

            {/* User Mode - Inline Text Editor */}
            {isUserMode && isEditing && selectedComponent && (
                <InlineTextEditor
                    selectedComponent={selectedComponent}
                    initialContent={selectedComponent.content}
                    bounds={selectedComponentBounds}
                    onSave={handleSaveContent}
                    onCancel={handleCancelEdit}
                />
            )}

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

            <NameModal
                open={nameModal.open}
                title={nameModal.title}
                defaultValue={nameModal.defaultValue}
                confirmLabel={nameModal.confirmLabel}
                onConfirm={(name) => nameModal.onConfirm?.(name)}
                onCancel={() => setNameModal((p) => ({ ...p, open: false }))}
            />
        </div>
    );
}