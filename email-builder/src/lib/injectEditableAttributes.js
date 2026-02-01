/**
 * Injects data-editable attributes into compiled HTML based on MJML source
 *
 * This is a workaround for mjml-browser not supporting mj-html-attributes.
 * It finds elements in MJML with specific mj-class values and adds corresponding
 * data-editable attributes to the compiled HTML.
 *
 * mj-class requires definitions in mj-attributes to output CSS classes. This helper
 * injects css-class into mj-attributes so mj-class="editable-X" produces class="editable-X".
 */

/**
 * Injects mj-class definitions so mj-class="editable-X" outputs class="editable-X" in HTML.
 * MJML requires mj-class to be defined in mj-attributes; without it, no class is output.
 * @param {string} mjmlSource - Full MJML document
 * @returns {string} MJML with mj-class definitions added to mj-attributes
 */
export function ensureEditableClassesInMjml(mjmlSource) {
    const mappings = extractEditableMappings(mjmlSource);
    if (mappings.length === 0) return mjmlSource;

    const uniqueClasses = [...new Set(mappings.map((m) => m.className))];
    const mjClassDefinitions = uniqueClasses
        .map((cls) => `<mj-class name="${cls}" css-class="${cls}" />`)
        .join('\n        ');

    // Inject into mj-attributes (after opening tag, or create mj-attributes if missing)
    if (mjmlSource.includes('<mj-attributes>')) {
        return mjmlSource.replace(
            '<mj-attributes>',
            `<mj-attributes>\n        ${mjClassDefinitions}`
        );
    }
    if (mjmlSource.includes('<mj-head>')) {
        return mjmlSource.replace(
            '<mj-head>',
            `<mj-head>\n    <mj-attributes>\n        ${mjClassDefinitions}\n    </mj-attributes>`
        );
    }
    return mjmlSource;
}

const EDITABLE_TAGS = ['mj-text', 'mj-button', 'mj-image'];

/**
 * Adds mj-class="editable-{tag}-{n}" to mj-text, mj-button, mj-image that lack mj-class.
 * Makes templates editable by default when entering User Mode.
 * @param {string} mjmlSource - MJML document or body-only fragment
 * @returns {string} MJML with mj-class added where missing
 */
export function ensureMjClassOnBodyComponents(mjmlSource) {
    if (!mjmlSource || typeof mjmlSource !== 'string') return mjmlSource;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<root>${mjmlSource}</root>`, 'text/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('MJML parsing error:', parserError.textContent);
            return mjmlSource;
        }

        const tagCounters = { 'mj-text': 0, 'mj-button': 0, 'mj-image': 0 };
        let modified = false;

        EDITABLE_TAGS.forEach((tagName) => {
            const elements = doc.querySelectorAll(tagName);
            elements.forEach((el) => {
                if (el.hasAttribute('mj-class')) return;
                tagCounters[tagName]++;
                const shortTag = tagName.replace('mj-', '');
                el.setAttribute('mj-class', `editable-${shortTag}-${tagCounters[tagName]}`);
                modified = true;
            });
        });

        if (!modified) return mjmlSource;

        const serializer = new XMLSerializer();
        const result = serializer.serializeToString(doc.documentElement);
        return result.replace(/^<root>/, '').replace(/<\/root>$/, '');
    } catch (error) {
        console.error('Error adding mj-class to body components:', error);
        return mjmlSource;
    }
}

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

        mappings.forEach(({ className, editableId, content, tagName }) => {
            // Find elements in HTML with this class
            const elements = doc.querySelectorAll(`.${className}`);

            elements.forEach((element) => {
                // Match by content when possible; MJML outputs nested tables so textContent may include extra whitespace
                const elText = element.textContent?.trim().replace(/\s+/g, ' ');
                const contentNorm = content.trim().replace(/\s+/g, ' ');
                const contentMatches = elText === contentNorm || elText.includes(contentNorm);

                if (contentMatches || elements.length === 1) {
                    element.setAttribute('data-editable', 'true');
                    element.setAttribute('data-editable-id', editableId);
                    const editableType =
                        tagName === 'mj-button' ? 'button' : tagName === 'mj-image' ? 'image' : 'text';
                    element.setAttribute('data-editable-type', editableType);
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
