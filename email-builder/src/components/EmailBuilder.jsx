import React, { useState, useEffect, useRef } from 'react';
import mjml2html from 'mjml-browser';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase'; // Ensure this file exists per previous steps

// 1. DEFINE THEMES
// These snippets will be injected into the <mj-head>
const THEMES = {
    default: '',
    dark: `
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text color="#ffffff" />
      <mj-section background-color="#1a202c" />
      <mj-body background-color="#000000" />
    </mj-attributes>
  `,
    brand: `
    <mj-attributes>
      <mj-all font-family="Georgia, serif" />
      <mj-text color="#2d3748" />
      <mj-button background-color="#4c51bf" color="white" border-radius="20px" />
      <mj-section background-color="#ebf8ff" />
    </mj-attributes>
  `
};

export default function EmailBuilder() {
    // State
    const [code, setCode] = useState(`
<mj-section>
  <mj-column>
    <mj-text font-size="20px">Hello World</mj-text>
    <mj-button>Click Me</mj-button>
  </mj-column>
</mj-section>
  `);

    const [preview, setPreview] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('default');
    const [isSaving, setIsSaving] = useState(false);
    const [compileErrors, setCompileErrors] = useState([]);
    const [savedThemeNames, setSavedThemeNames] = useState([]);
    const [savedThemesFull, setSavedThemesFull] = useState([]);

    // Load custom theme names on mount
    useEffect(() => {
        const fetchThemes = async () => {
            const { data } = await supabase.from('themes').select('*');
            if (data) {
                const mapped = data.map(t => ({
                    id: t.id,
                    name: t.name,
                    fontFamily: t.font_family,
                    textColor: t.text_color,
                    backgroundColor: t.background_color,
                    accentColor: t.accent_color
                }));
                setSavedThemesFull(mapped);
                setSavedThemeNames(mapped.map(t => t.name));
            }
        };
        fetchThemes();
    }, []);

    // Refs
    const editorRef = useRef(null);
    const cloudinaryRef = useRef();
    const widgetRef = useRef();

    // ----------------------------------------------------------------
    // A. COMPILER ENGINE (Runs whenever Code or Theme changes)
    // ----------------------------------------------------------------
    // Generate preview whenever code or theme changes
    useEffect(() => {
        try {
            // Check if selected theme is a custom one or a preset
            let themeMjml = THEMES[selectedTheme] || '';

            // If not a preset, try finding it in saved themes
            if (!THEMES[selectedTheme]) {
                const custom = savedThemesFull.find(t => t.name === selectedTheme);
                if (custom) {
                    themeMjml = `
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

            // Wrap user's body code with the standard MJML structure + Theme
            const finalMjml = `
        <mjml>
          <mj-head>
            <mj-preview>Email Preview</mj-preview>
            ${themeMjml}
          </mj-head>
          <mj-body>
            ${code}
          </mj-body>
        </mjml>
      `;

            // Compile to HTML
            const { html, errors } = mjml2html(finalMjml, { validationLevel: 'soft' });

            if (errors.length > 0) {
                console.warn("MJML Errors:", errors);
                setCompileErrors(errors);
            } else {
                setCompileErrors([]);
            }

            // Inject script for interactive validation and image clicking
            const script = `
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        const images = document.querySelectorAll('img');
                        images.forEach((img, index) => {
                            img.style.cursor = 'pointer';
                            img.title = 'Click to replace image';
                            img.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.parent.postMessage({
                                    type: 'IMAGE_CLICK',
                                    index: index,
                                    src: img.src
                                }, '*');
                            });
                        });
                    });
                </script>
            `;

            // Insert script before closing body tag
            const finalHtml = html.replace('</body>', `${script}</body>`);
            setPreview(finalHtml);

        } catch (e) {
            console.error("Compilation Error:", e);
        }
    }, [code, selectedTheme, savedThemesFull]);

    // ----------------------------------------------------------------
    // B. CLOUDINARY INTEGRATION
    // ----------------------------------------------------------------
    const [activeImageIndex, setActiveImageIndex] = useState(null);

    // Listen for messages from the preview iframe
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'IMAGE_CLICK') {
                setActiveImageIndex(event.data.index);
                // Open Cloudinary widget
                widgetRef.current?.open();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);


    // ... wait, previously we just created the widget once on mount. 
    // To access the *current* state inside the callback without recreating the widget, we should use a Ref for the index.
    const activeIndexRef = useRef(null);
    useEffect(() => { activeIndexRef.current = activeImageIndex; }, [activeImageIndex]);

    // Re-writing the effect to be cleaner and use the ref
    useEffect(() => {
        if (window.cloudinary) {
            cloudinaryRef.current = window.cloudinary;
            widgetRef.current = cloudinaryRef.current.createUploadWidget({
                cloudName: 'makingthings',
                uploadPreset: 'astro-uploads',
                sources: ['local', 'url', 'camera'],
                multiple: false
            }, (error, result) => {
                if (!error && result && result.event === 'success') {
                    const newUrl = result.info.secure_url;
                    if (activeIndexRef.current !== null) {
                        replaceImageInCode(activeIndexRef.current, newUrl);
                        setActiveImageIndex(null);
                    } else {
                        insertImageAtCursor(newUrl);
                    }
                }
            });
        }
    }, []);

    const replaceImageInCode = (index, newUrl) => {
        if (!newUrl) return;

        setCode((currentCode) => {
            // Find all mj-image tags
            // Robust regex to match src attribute with double or single quotes
            const regex = /<mj-image[^>]*src=["']([^"']*)["'][^>]*>/g;
            let match;
            let count = 0;

            // We need to match the N-th occurrence in the code
            while ((match = regex.exec(currentCode)) !== null) {
                if (count === index) {
                    const fullTag = match[0];
                    console.log(`[EmailBuilder] Replacing image at index ${index}`, fullTag);

                    // Replace src="..." or src='...' with new url
                    const newTag = fullTag.replace(/src=["'][^"']*["']/, `src="${newUrl}"`);
                    console.log(`[EmailBuilder] New tag:`, newTag);

                    const start = match.index;
                    const end = start + fullTag.length;

                    return currentCode.substring(0, start) + newTag + currentCode.substring(end);
                }
                count++;
            }
            console.warn(`[EmailBuilder] No match found for index ${index}`);
            return currentCode;
        });
    };

    // The "Anti-Gravity" Function: Inserts text exactly where the cursor is
    const insertImageAtCursor = (url) => {
        const editor = editorRef.current;
        if (!editor) return;

        const position = editor.getPosition();
        const textToInsert = `<mj-image src="${url}" width="300px" alt="Uploaded Image" />`;

        // Direct Monaco Edit Operation
        editor.executeEdits("cloudinary-insert", [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            },
            text: textToInsert,
            forceMoveMarkers: true
        }]);

        // Auto-format the code to look nice
        editor.getAction('editor.action.formatDocument').run();
    };

    // ----------------------------------------------------------------
    // C. SUPABASE SAVING
    // ----------------------------------------------------------------
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('templates')
                .insert([{
                    mjml_code: code,
                    theme_config: { mode: selectedTheme },
                    name: "Untitled Draft" // You could add an input for this
                }]);

            if (error) throw error;
            alert("Template saved successfully!");
        } catch (error) {
            alert("Error saving: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ----------------------------------------------------------------
    // D. RENDER
    // ----------------------------------------------------------------
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">

            {/* 1. TOOLBAR */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-100">MJML Builder</h1>
                    <a href="/themes" className="text-sm text-blue-400 hover:underline">Manage Themes</a>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Theme Selector */}
                    <select
                        value={selectedTheme}
                        onChange={(e) => setSelectedTheme(e.target.value)}
                        className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 outline-none focus:border-blue-500"
                    >
                        <option value="default">Default Theme</option>
                        <option value="dark">Dark Mode</option>
                        <option value="brand">Brand Style</option>
                        {savedThemeNames.length > 0 && <optgroup label="Custom Themes">
                            {savedThemeNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </optgroup>}
                    </select>

                    {/* Upload Button */}
                    <button
                        onClick={() => widgetRef.current?.open()}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition"
                    >
                        <span>📷</span> Insert Image
                    </button>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-6 py-2 rounded font-bold transition ${isSaving
                            ? 'bg-green-800 cursor-wait'
                            : 'bg-green-600 hover:bg-green-500'
                            }`}
                    >
                        {isSaving ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>

            {/* 2. MAIN WORKSPACE */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left: Monaco Editor */}
                <div className="w-1/2 border-r border-gray-700">
                    <Editor
                        height="100%"
                        defaultLanguage="xml" // XML works well for MJML highlighting
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        onMount={(editor, monaco) => {
                            editorRef.current = editor;

                            // Register MJML completion provider
                            // Only register once to avoid duplicates if re-mounted (scoped to this instance via closure if needed, but 'xml' is global)
                            // A better way is to check if we already registered or just dispose previous. 
                            // For simplicity in this functional component, we'll just try-register
                            // Note: disposing global providers is tricky without storing the disposable. 

                            // MJML Tags definition
                            const mjmlTags = [
                                {
                                    label: 'mjml',
                                    insertText: '<mjml>\n  <mj-body>\n    $0\n  </mj-body>\n</mjml>',
                                    detail: 'Root tag of MJML'
                                },
                                {
                                    label: 'mj-head',
                                    insertText: '<mj-head>\n  $0\n</mj-head>',
                                    detail: 'Header section'
                                },
                                {
                                    label: 'mj-attributes',
                                    insertText: '<mj-attributes>\n  $0\n</mj-attributes>',
                                    detail: 'Define default attributes'
                                },
                                {
                                    label: 'mj-body',
                                    insertText: '<mj-body>\n  $0\n</mj-body>',
                                    detail: 'Body section'
                                },
                                {
                                    label: 'mj-section',
                                    insertText: '<mj-section>\n  <mj-column>\n    $0\n  </mj-column>\n</mj-section>',
                                    detail: 'Row/Section'
                                },
                                {
                                    label: 'mj-column',
                                    insertText: '<mj-column>\n  $0\n</mj-column>',
                                    detail: 'Column'
                                },
                                {
                                    label: 'mj-text',
                                    insertText: '<mj-text font-size="20px" color="#000000" font-family="Arial">\n  $0\n</mj-text>',
                                    detail: 'Text element'
                                },
                                {
                                    label: 'mj-image',
                                    insertText: '<mj-image src="https://placehold.co/600x400/000000/FFF" alt="Placeholder Image" />',
                                    detail: 'Image element'
                                },
                                {
                                    label: 'mj-button',
                                    insertText: '<mj-button background-color="#414141" color="#ffffff" href="#">\n  $0\n</mj-button>',
                                    detail: 'Button element'
                                },
                                {
                                    label: 'mj-divider',
                                    insertText: '<mj-divider border-color="#F45E43" />',
                                    detail: 'Divider element'
                                },
                                {
                                    label: 'mj-spacer',
                                    insertText: '<mj-spacer height="20px" />',
                                    detail: 'Spacer element'
                                }
                            ];

                            // Check if languages are available
                            if (monaco && monaco.languages) {
                                monaco.languages.registerCompletionItemProvider('xml', {
                                    provideCompletionItems: (model, position) => {
                                        const suggestions = mjmlTags.map(tag => ({
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
                                        }));
                                        return { suggestions: suggestions };
                                    }
                                });
                            }
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

                {/* Right: Preview */}
                <div className="w-1/2 bg-white relative">
                    <div className="absolute top-0 left-0 bg-gray-200 text-gray-600 text-xs px-2 py-1 z-10 opacity-75">
                        Live Preview ({selectedTheme})
                    </div>
                    {compileErrors.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-100 text-red-800 p-2 text-xs overflow-y-auto max-h-32 z-20 border-t border-red-200">
                            <strong>Validation Errors:</strong>
                            <ul className="list-disc pl-4 mt-1">
                                {compileErrors.map((err, i) => (
                                    <li key={i}>{err.message || JSON.stringify(err)}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <iframe
                        title="MJML Preview"
                        srcDoc={preview}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts" // Security best practice
                    />
                </div>
            </div>
        </div>
    );
}