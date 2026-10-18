/**
 * utils-html.js
 * Shared HTML utility functions
 */

const HtmlUtils = {
    /**
     * Escape a string for safe insertion into HTML content.
     * Does NOT escape quotes — not safe for interpolation into HTML
     * attribute values without additional handling. (Issue #178)
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },

    /**
     * Escape a string for an HTML attribute value in double or single
     * quotes, as well as for text content: & < > " ' (Issue #337)
     */
    escapeAttr(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/[&<>"']/g, c => HtmlUtils.ATTR_ENTITIES[c]);
    },

    ATTR_ENTITIES: { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
