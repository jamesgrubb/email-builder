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

/**
 * Updates the content of an editable component in MJML code
 * Preserves all attributes and only changes text content
 *
 * @param {string} mjmlCode - The MJML source code
 * @param {string} editableId - The data-editable-id of the component to update
 * @param {string} newContent - The new text content
 * @param {object} validationOptions - Optional validation options
 * @returns {object} { success: boolean, mjml: string, error: string|null }
 */
export function updateEditableContent(mjmlCode, editableId, newContent, validationOptions = {}) {
    if (!mjmlCode || !editableId) {
        return {
            success: false,
            mjml: mjmlCode,
            error: 'Missing required parameters: mjmlCode and editableId are required'
        };
    }

    // Validate content
    const validation = validateContent(newContent, validationOptions);
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

        // Find the element by mj-class (MJML uses mj-class, not data-editable-id)
        const element = doc.querySelector(`[mj-class="editable-${editableId}"]`);

        if (!element) {
            const errorMsg = `Component with ID "${editableId}" not found`;
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
 * Duplicates an editable component in MJML code
 * Generates new unique ID for the clone
 *
 * @param {string} mjmlCode - The MJML source code
 * @param {string} editableId - The data-editable-id of the component to duplicate
 * @returns {object} { success: boolean, mjml: string, error: string|null, newId: string|null }
 */
export function duplicateComponent(mjmlCode, editableId) {
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
            const errorMsg = 'Invalid MJML structure - cannot parse XML';
            console.error(errorMsg, parserError.textContent);
            return {
                success: false,
                mjml: mjmlCode,
                error: errorMsg,
                newId: null
            };
        }

        // Find the original element by mj-class (MJML uses mj-class, not data-editable-id)
        const original = doc.querySelector(`[mj-class="editable-${editableId}"]`);

        if (!original) {
            const errorMsg = `Component with ID "${editableId}" not found`;
            console.warn(errorMsg);
            return {
                success: false,
                mjml: mjmlCode,
                error: errorMsg,
                newId: null
            };
        }

        // Clone the element deeply
        const clone = original.cloneNode(true);

        // Generate new unique ID and set mj-class so the clone is recognized as editable
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        const newId = `${editableId}-copy-${timestamp}-${random}`;
        clone.setAttribute('mj-class', `editable-${newId}`);

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
 * Deletes an editable component from MJML code
 *
 * @param {string} mjmlCode - The MJML source code
 * @param {string} editableId - The data-editable-id of the component to delete
 * @returns {object} { success: boolean, mjml: string, error: string|null }
 */
export function deleteComponent(mjmlCode, editableId) {
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

        // Find the element by mj-class (MJML uses mj-class, not data-editable-id)
        const element = doc.querySelector(`[mj-class="editable-${editableId}"]`);

        if (!element) {
            const errorMsg = `Component with ID "${editableId}" not found`;
            console.warn(errorMsg);
            return {
                success: false,
                mjml: mjmlCode,
                error: errorMsg
            };
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
