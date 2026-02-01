/**
 * Validation options for content updates
 */
const DEFAULT_VALIDATION = {
    maxLength: 5000, // Maximum characters
    allowEmpty: false, // Allow empty content
    trim: true, // Trim whitespace
};

/**
 * Validates content before updating
 * @param {string} content - Content to validate
 * @param {object} options - Validation options
 * @returns {object} { valid: boolean, error: string|null, sanitized: string }
 */
function validateContent(content, options = DEFAULT_VALIDATION) {
    const opts = { ...DEFAULT_VALIDATION, ...options };

    // Trim if enabled
    const sanitized = opts.trim ? content.trim() : content;

    // Check if empty
    if (!opts.allowEmpty && sanitized.length === 0) {
        return { valid: false, error: 'Content cannot be empty', sanitized };
    }

    // Check length
    if (sanitized.length > opts.maxLength) {
        return {
            valid: false,
            error: `Content too long (${sanitized.length}/${opts.maxLength} characters)`,
            sanitized
        };
    }

    return { valid: true, error: null, sanitized };
}

function normalizeText(str) {
    return String(str || '').trim().replace(/\s+/g, ' ');
}

function findEditableElement(doc, editableId, content) {
    const selector = `[mj-class~="editable-${editableId}"]`;
    const candidates = Array.from(doc.querySelectorAll(selector));
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const contentNorm = normalizeText(content);
    if (!contentNorm) return candidates[0];
    const byContent = candidates.find((el) => normalizeText(el.textContent) === contentNorm);
    if (byContent) return byContent;
    const byIncludes = candidates.find((el) => normalizeText(el.textContent).includes(contentNorm));
    return byIncludes || candidates[0];
}

/**
 * Updates the content of an editable component in MJML code
 * Preserves all attributes and only changes text content
 * Uses currentContent to find the exact element when multiple match (same as delete/duplicate)
 *
 * @param {string} mjmlCode - The MJML source code
 * @param {string} editableId - The data-editable-id of the component to update
 * @param {string} newContent - The new text content to save
 * @param {string} [currentContent] - Current content for element disambiguation
 * @param {object} validationOptions - Optional validation options
 * @returns {object} { success: boolean, mjml: string, error: string|null }
 */
export function updateEditableContent(mjmlCode, editableId, newContent, currentContentOrOpts, validationOptions = {}) {
    const currentContent = typeof currentContentOrOpts === 'string' ? currentContentOrOpts : undefined;
    const opts = typeof currentContentOrOpts === 'object' && currentContentOrOpts && !Array.isArray(currentContentOrOpts) ? currentContentOrOpts : validationOptions;
    if (!mjmlCode || !editableId) {
        return {
            success: false,
            mjml: mjmlCode,
            error: 'Missing required parameters: mjmlCode and editableId are required'
        };
    }

    const validation = validateContent(newContent, opts);
    if (!validation.valid) {
        return {
            success: false,
            mjml: mjmlCode,
            error: validation.error
        };
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<root>${mjmlCode}</root>`, 'text/xml');

        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            const errorMsg = 'Invalid MJML structure - cannot parse XML';
            console.error(errorMsg, parserError.textContent);
            return {
                success: false,
                mjml: mjmlCode,
                error: errorMsg
            };
        }

        const element = findEditableElement(doc, editableId, currentContent);

        if (!element) {
            const errorMsg = `Component "${editableId}" not found`;
            console.warn(errorMsg);
            return {
                success: false,
                mjml: mjmlCode,
                error: errorMsg
            };
        }

        // Update text content only, preserve all attributes
        // Note: textContent setter automatically escapes XML special characters
        element.textContent = validation.sanitized;

        // Serialize back to string
        const serializer = new XMLSerializer();
        const result = serializer.serializeToString(doc.documentElement);

        // Remove root wrapper tags
        const updatedMjml = result.replace(/^<root>/, '').replace(/<\/root>$/, '');

        return {
            success: true,
            mjml: updatedMjml,
            error: null
        };
    } catch (error) {
        console.error('Error updating editable content:', error);
        return {
            success: false,
            mjml: mjmlCode,
            error: `Failed to update content: ${error.message}`
        };
    }
}

/**
 * Duplicates an editable component in MJML code.
 * Uses content + editableId for precise element selection (same as deleteComponent).
 *
 * @param {string} mjmlCode - The MJML source code
 * @param {string} editableId - The data-editable-id
 * @param {string} content - The text content (for disambiguation when multiple match)
 * @returns {object} { success: boolean, mjml: string, error: string|null, newId: string|null }
 */
export function duplicateComponent(mjmlCode, editableId, content) {
    if (!mjmlCode || !editableId) {
        return {
            success: false,
            mjml: mjmlCode,
            error: 'Missing required parameters: mjmlCode and editableId are required',
            newId: null
        };
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<root>${mjmlCode}</root>`, 'text/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            return {
                success: false,
                mjml: mjmlCode,
                error: 'Invalid MJML structure - cannot parse XML',
                newId: null
            };
        }

        const original = findEditableElement(doc, editableId, content);

        if (!original) {
            return {
                success: false,
                mjml: mjmlCode,
                error: `Component "${editableId}" not found`,
                newId: null
            };
        }

        const existingClass = (original.getAttribute('mj-class') || '').split(/\s+/).find((c) => c.startsWith('editable-'));
        const baseId = existingClass ? existingClass.replace(/^editable-/, '') : editableId;

        const clone = original.cloneNode(true);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        const newId = `${baseId}-copy-${timestamp}-${random}`;
        const currentMjClass = clone.getAttribute('mj-class') || '';
        const newMjClass = currentMjClass.replace(/editable-[^\s]+/, `editable-${newId}`);
        clone.setAttribute('mj-class', newMjClass || `editable-${newId}`);

        // Insert after original
        if (original.nextSibling) {
            original.parentNode.insertBefore(clone, original.nextSibling);
        } else {
            original.parentNode.appendChild(clone);
        }

        // Serialize back to string
        const serializer = new XMLSerializer();
        const result = serializer.serializeToString(doc.documentElement);

        const updatedMjml = result.replace(/^<root>/, '').replace(/<\/root>$/, '');

        return {
            success: true,
            mjml: updatedMjml,
            error: null,
            newId
        };
    } catch (error) {
        console.error('Error duplicating component:', error);
        return {
            success: false,
            mjml: mjmlCode,
            error: `Failed to duplicate component: ${error.message}`,
            newId: null
        };
    }
}

/**
 * Deletes an editable component from MJML code.
 * Uses content + editableId to find the exact element (robust against ordering mismatches).
 *
 * @param {string} mjmlCode - The MJML source code
 * @param {string} editableId - The data-editable-id (e.g. "text-1")
 * @param {string} content - The text content of the clicked element (for precise matching)
 * @returns {object} { success: boolean, mjml: string, error: string|null }
 */
export function deleteComponent(mjmlCode, editableId, content) {
    if (!mjmlCode || !editableId) {
        return {
            success: false,
            mjml: mjmlCode,
            error: 'Missing required parameters: mjmlCode and editableId are required'
        };
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<root>${mjmlCode}</root>`, 'text/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            const errorMsg = 'Invalid MJML structure - cannot parse XML';
            console.error(errorMsg, parserError.textContent);
            return {
                success: false,
                mjml: mjmlCode,
                error: errorMsg
            };
        }

        // Find candidates: elements with mj-class containing editable-{editableId}
        const selector = `[mj-class~="editable-${editableId}"]`;
        const candidates = Array.from(doc.querySelectorAll(selector));

        const contentNorm = normalizeText(content);
        let element = null;

        if (candidates.length === 1) {
            element = candidates[0];
        } else if (candidates.length > 1 && contentNorm) {
            // Match by content to pick the exact one
            element = candidates.find((el) => {
                const elText = normalizeText(el.textContent);
                return elText === contentNorm;
            });
            if (!element && contentNorm) {
                element = candidates.find((el) => normalizeText(el.textContent).includes(contentNorm));
            }
            if (!element) element = candidates[0];
        } else if (candidates.length > 0) {
            element = candidates[0];
        }

        if (!element) {
            const err = `Component "${editableId}" not found`;
            console.warn(err);
            return { success: false, mjml: mjmlCode, error: err };
        }

        // Remove the element
        element.parentNode.removeChild(element);

        // Serialize back to string
        const serializer = new XMLSerializer();
        const result = serializer.serializeToString(doc.documentElement);

        const updatedMjml = result.replace(/^<root>/, '').replace(/<\/root>$/, '');

        return {
            success: true,
            mjml: updatedMjml,
            error: null
        };
    } catch (error) {
        console.error('Error deleting component:', error);
        return {
            success: false,
            mjml: mjmlCode,
            error: `Failed to delete component: ${error.message}`
        };
    }
}
