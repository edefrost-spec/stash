export function applyFormatBarMixin(proto) {
  proto.bindFormatBar = function() {
    const textareas = [
      document.getElementById('quick-note-textarea'),
      document.getElementById('quick-note-modal-textarea'),
      document.getElementById('edit-note-textarea')
    ].filter(Boolean);

    textareas.forEach(textarea => {
      textarea.addEventListener('mouseup', () => this.checkSelection(textarea));
      textarea.addEventListener('keyup', (e) => {
        // Only check on shift+arrow keys (selection change)
        if (e.shiftKey) {
          this.checkSelection(textarea);
        }
      });
    });

    // Close on outside click
    document.addEventListener('mousedown', (e) => {
      const formatBar = document.getElementById('format-bar');
      if (formatBar && !formatBar.contains(e.target) && !e.target.closest('textarea')) {
        this.hideFormatBar();
      }
    });

    // Format button clicks
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const formatBar = document.getElementById('format-bar');
        const targetId = formatBar?.dataset.targetId;
        const textarea = targetId ? document.getElementById(targetId) : null;
        if (textarea) {
          this.insertMarkdownFormatting(textarea, btn.dataset.action);
        }
      });
    });
  };

  proto.checkSelection = function(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      this.showFormatBar(textarea);
    } else {
      this.hideFormatBar();
    }
  };

  proto.showFormatBar = function(textarea) {
    const bar = document.getElementById('format-bar');
    if (!bar) return;

    const rect = textarea.getBoundingClientRect();

    // Position above the textarea, horizontally centered
    bar.style.top = `${rect.top + window.scrollY - 44}px`;
    bar.style.left = `${rect.left + rect.width / 2 - 80}px`;
    bar.classList.remove('hidden');
    bar.dataset.targetId = textarea.id;
  };

  proto.hideFormatBar = function() {
    const bar = document.getElementById('format-bar');
    bar?.classList.add('hidden');
  };

  proto.insertMarkdownFormatting = function(textarea, action) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let before = '';
    let after = '';
    let placeholder = '';

    switch (action) {
      case 'bold':
        before = '**';
        after = '**';
        placeholder = 'bold text';
        break;
      case 'italic':
        before = '*';
        after = '*';
        placeholder = 'italic text';
        break;
      case 'heading':
        before = '## ';
        after = '';
        placeholder = 'Heading';
        break;
      case 'link':
        before = '[';
        after = '](url)';
        placeholder = 'link text';
        break;
      case 'list':
        before = '\n- ';
        after = '';
        placeholder = 'list item';
        break;
      case 'task':
        before = '\n- [ ] ';
        after = '';
        placeholder = 'task';
        break;
      case 'blockquote':
        before = '\n> ';
        after = '';
        placeholder = 'quote text';
        break;
      case 'code':
        before = '\n```\n';
        after = '\n```\n';
        placeholder = 'code';
        break;
      case 'divider':
        before = '\n---\n';
        after = '';
        placeholder = '';
        break;
      default:
        return;
    }

    const insertion = selected || placeholder;
    const newText = text.substring(0, start) + before + insertion + after + text.substring(end);

    textarea.value = newText;
    textarea.focus();

    // Position cursor appropriately
    if (selected) {
      // If there was selected text, place cursor after the formatting
      const newPos = start + before.length + insertion.length + after.length;
      textarea.setSelectionRange(newPos, newPos);
    } else {
      // If no selection, select the placeholder text
      const selectStart = start + before.length;
      const selectEnd = selectStart + placeholder.length;
      textarea.setSelectionRange(selectStart, selectEnd);
    }

    this.hideFormatBar();

    // Trigger input event for any listeners
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  proto.lightenColor = function(hex, percent) {
    if (!hex) return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };
}
