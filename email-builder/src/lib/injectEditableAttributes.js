/**
 * Injects data-editable attributes into compiled HTML based on MJML source
 *
 * This is a workaround for mjml-browser not supporting mj-html-attributes.
 * It finds elements in MJML with specific mj-class values and adds corresponding
 * data-editable attributes to the compiled HTML.
 */

/**
 * Extracts editable component mappings from MJML source
 * Returns array of { className, editableId, content }
 */
export function extractEditableMappings(mjmlSource) {
    const mappings = [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<root>${mjmlSource}</root>`, 'text/xml');

        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('MJML parsing error:', parserError.textContent);
            return mappings;
        }

        // Find all elements with mj-class attribute
        const elements = doc.querySelectorAll('[mj-class]');

        elements.forEach((element) => {
            const className = element.getAttribute('mj-class');
            const content = element.textContent?.trim() || '';

            // Generate editable ID from class name and content
            const editableId = className.replace(/^editable-/, '');

            // Only process classes that start with 'editable-'
            if (className && className.startsWith('editable-')) {
                mappings.push({
                    className,
                    editableId,
                    content,
                    tagName: element.tagName.toLowerCase()
                });
            }
        });

    } catch (error) {
        console.error('Error extracting editable mappings:', error);
    }

    return mappings;
}

/**
 * Injects data-editable attributes into compiled HTML
 * @param {string} compiledHtml - The HTML output from MJML compilation
 * @param {Array} mappings - Array of { className, editableId, content }
 * @returns {string} HTML with injected attributes
 */
export function injectEditableAttributes(compiledHtml, mappings) {
    if (!mappings || mappings.length === 0) {
        return compiledHtml;
    }

    let modifiedHtml = compiledHtml;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(compiledHtml, 'text/html');

        mappings.forEach(({ className, editableId, content }) => {
            // Find elements in HTML with this class
            const elements = doc.querySelectorAll(`.${className}`);

            elements.forEach((element) => {
                // Match by content to ensure we get the right element
                if (element.textContent?.trim() === content) {
                    element.setAttribute('data-editable', 'true');
                    element.setAttribute('data-editable-id', editableId);
                }
            });
        });

        // Serialize back to HTML
        modifiedHtml = doc.documentElement.outerHTML;

    } catch (error) {
        console.error('Error injecting editable attributes:', error);
        return compiledHtml;
    }

    return modifiedHtml;
}
