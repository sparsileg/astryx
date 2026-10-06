/**
 * algorithm-validation-view.js
 * "Validate Algorithms" admin view — runs astronomy calculation regression
 * tests and displays pass/fail results.
 */

const AlgorithmValidationView = {
    results: [],

    init() {
        this.runTests();
        this.render();
    },

    destroy() {
        // No listeners/observers yet — stub for router consistency
    },

    runTests() {
        this.results = AlgorithmValidation.runAll();
    },

    formatValue(value) {
        if (typeof value !== 'number') return value;
        // Round to 6 decimal places, then strip trailing zeros
        return parseFloat(value.toFixed(6)).toString();
    },

    render() {
        const tbody = document.getElementById('algorithm-validation-tbody');
        const summaryEl = document.getElementById('algorithm-validation-summary');

        if (tbody) {
            tbody.innerHTML = '';
            this.results.forEach(result => {
                const row = document.createElement('tr');
                row.className = result.pass ? 'validation-pass' : 'validation-fail';
                row.innerHTML = `
                    <td>${result.name}</td>
                    <td>${this.formatValue(result.expected)}</td>
                    <td>${this.formatValue(result.actual)}</td>
                    <td>${result.pass ? 'PASS' : 'FAIL'}</td>
                `;
                tbody.appendChild(row);
            });
        }

        if (summaryEl) {
            const passCount = this.results.filter(r => r.pass).length;
            summaryEl.textContent = `${passCount}/${this.results.length} tests`;
        }
    }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
