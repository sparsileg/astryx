# Help System - Usage Guide

## Overview

The help system uses markdown files that are bundled into JavaScript for local file access (no web server required).

## Directory Structure

```
specula/
├── help/                          # Markdown help files (edit these)
│   └── calculate-best-months.md
│   └── build-help.py              # Build script
├── js/
│   └── help-content.js            # Auto-generated (don't edit)
```

## Adding New Help Files

1. **Create markdown file** in `help/` folder:
   ```
   help/my-new-feature.md
   ```

2. **Run build script**:
   ```bash
   python help/build-help.py
   ```

   This generates/updates `js/help-content.js` with all help content.

3. **Use in code**:
   ```javascript
   // In your modal setup:
   helpBtn.onclick = () => this.showMarkdownHelp('my-new-feature');
   ```

   The key matches the filename without `.md` extension.

## Editing Existing Help

1. Edit the `.md` file in `help/` folder
2. Run `python help/build-help.py`
3. Refresh your browser

## How It Works

- **Markdown files**: Written in standard markdown, stored in `help/`
- **Build script**: Reads all `.md` files, converts to JavaScript strings
- **help-content.js**: Contains all help as a JavaScript object
- **marked.js**: Renders markdown to HTML at runtime

## Requirements

- Python 3.x (for build script)
- `marked.min.js` in `include/` folder
- `help-content.js` placed in the `help/`

## Script Tag Order in index.html

```html
<script src="js/config.js"></script>
<script src="include/marked.min.js"></script>    <!-- Markdown renderer -->
<script src="js/help-content.js"></script>        <!-- Help content -->
<script src="js/ui-manager.js"></script>          <!-- Uses HelpContent -->
```

## Benefits

- ✅ Works with `file://` protocol (no web server needed)
- ✅ Edit markdown files directly
- ✅ One command to rebuild
- ✅ All help content in one file (fast loading)
- ✅ Easy to add new help topics

## Notes

- Don't edit `js/help-content.js` directly - it's auto-generated
- Filename becomes the help key (e.g., `my-help.md` → `'my-help'`)
- Build script must be run after any markdown changes
- Template literals used, so backticks in markdown are escaped automatically
