/**
 * Parses compiled HTML to find components marked as editable
 * Returns a registry of editable components with their metadata
 *
 * NOTE: This parses the COMPILED HTML output, not the MJML source!
 * The data-editable attributes are added by mj-html-attributes during compilation.
 */

export function parseEditableComponents(compiledHtml) {
    if (!compiledHtml || typeof compiledHtml !== 'string') {
        return [];
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(compiledHtml, 'text/html');

        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('HTML parsing error:', parserError.textContent);
            return [];
        }

        const editableComponents = [];
        const elements = doc.querySelectorAll('[data-editable="true"]');

        elements.forEach((element, domIndex) => {
            const editableId = element.getAttribute('data-editable-id');
            const editableType = element.getAttribute('data-editable-type') || 'text';
            const idxAttr = element.getAttribute('data-editable-index');
            const index = idxAttr != null ? parseInt(idxAttr, 10) : domIndex;

            if (!editableId) {
                console.warn(`Editable component at index ${domIndex} missing data-editable-id attribute`);
                return;
            }

            editableComponents.push({
                id: editableId,
                type: editableType,
                tagName: element.tagName.toLowerCase(),
                content: element.textContent?.trim() || '',
                attributes: getElementAttributes(element),
                index: Number.isNaN(index) ? domIndex : index
            });
        });

        return editableComponents;
    } catch (error) {
        console.error('Error parsing editable components:', error);
        return [];
    }
}

/**
 * Extracts all attributes from an element
 */
function getElementAttributes(element) {
    const attrs = {};
    Array.from(element.attributes).forEach(attr => {
        attrs[attr.name] = attr.value;
    });
    return attrs;
}

/**
 * Checks if compiled HTML has any editable components
 */
export function hasEditableComponents(compiledHtml) {
    const components = parseEditableComponents(compiledHtml);
    return components.length > 0;
}

/**
 * Gets a specific editable component by ID from compiled HTML
 */
export function getEditableComponent(compiledHtml, editableId) {
    const components = parseEditableComponents(compiledHtml);
    return components.find(comp => comp.id === editableId);
}
