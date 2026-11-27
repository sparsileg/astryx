/**
 * utils-html.js
 * Shared HTML utility functions
 */

const HtmlUtils = {
    /**
     * Escape a string for HTML text content and for an attribute value in
     * double or single quotes: & < > " ' (Issues #178, #337, #362).
     * No DOM use, so the HTML builders can be tested under Node.
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/[&<>"']/g, c => HtmlUtils.ENTITIES[c]);
    },

    ENTITIES: { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
