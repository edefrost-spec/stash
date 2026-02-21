// Note WYSIWYG Editor
// A lightweight contenteditable rich-text editor that stores as markdown.
// Converts markdown ↔ HTML so the database format stays unchanged.

export function applyNoteWysiwygMixin(proto) {

  // ─── Markdown → HTML ────────────────────────────────────────────────────────

  proto.mdToHtml = function(md) {
    if (!md || !md.trim()) return '<p><br></p>';

    const lines = md.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push(`<pre data-lang="${this._escAttr(lang)}"><code>${this._escHtml(codeLines.join('\n'))}</code></pre>`);
        i++;
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}\s*$/.test(line.trim())) {
        blocks.push('<hr>');
        i++;
        continue;
      }

      // Headings
      const h1 = line.match(/^#\s+(.*)/);
      if (h1) { blocks.push(`<h1>${this._inlineToHtml(h1[1])}</h1>`); i++; continue; }
      const h2 = line.match(/^##\s+(.*)/);
      if (h2) { blocks.push(`<h2>${this._inlineToHtml(h2[1])}</h2>`); i++; continue; }
      const h3 = line.match(/^###\s+(.*)/);
      if (h3) { blocks.push(`<h3>${this._inlineToHtml(h3[1])}</h3>`); i++; continue; }

      // Blockquote — collect consecutive > lines
      if (line.startsWith('> ') || line === '>') {
        const quoteLines = [];
        while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        blocks.push(`<blockquote>${this._inlineToHtml(quoteLines.join(' '))}</blockquote>`);
        continue;
      }

      // Task list item
      const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s*(.*)/);
      if (taskMatch) {
        // Collect consecutive task items into one list
        const taskItems = [];
        while (i < lines.length && lines[i].match(/^[-*]\s+\[([ xX])\]\s*(.*)/)) {
          const m = lines[i].match(/^[-*]\s+\[([ xX])\]\s*(.*)/);
          const checked = m[1].toLowerCase() === 'x';
          taskItems.push(
            `<li class="task-item"><input type="checkbox"${checked ? ' checked' : ''}><span>${this._inlineToHtml(m[2])}</span></li>`
          );
          i++;
        }
        blocks.push(`<ul class="task-list">${taskItems.join('')}</ul>`);
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^[-*]\s+(.*)/);
      if (ulMatch) {
        const listItems = [];
        while (i < lines.length && lines[i].match(/^[-*]\s+(.*)/)) {
          const m = lines[i].match(/^[-*]\s+(.*)/);
          listItems.push(`<li>${this._inlineToHtml(m[1])}</li>`);
          i++;
        }
        blocks.push(`<ul>${listItems.join('')}</ul>`);
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^\d+\.\s+(.*)/);
      if (olMatch) {
        const listItems = [];
        while (i < lines.length && lines[i].match(/^\d+\.\s+(.*)/)) {
          const m = lines[i].match(/^\d+\.\s+(.*)/);
          listItems.push(`<li>${this._inlineToHtml(m[1])}</li>`);
          i++;
        }
        blocks.push(`<ol>${listItems.join('')}</ol>`);
        continue;
      }

      // Blank line
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Paragraph
      const paraLines = [];
      while (i < lines.length && lines[i].trim() !== '' &&
             !lines[i].startsWith('#') && !lines[i].startsWith('>') &&
             !lines[i].startsWith('```') && !lines[i].match(/^[-*]\s/) &&
             !lines[i].match(/^\d+\.\s/) && !/^[-*_]{3,}\s*$/.test(lines[i].trim())) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length) {
        blocks.push(`<p>${this._inlineToHtml(paraLines.join('\n'))}</p>`);
      }
    }

    return blocks.length ? blocks.join('') : '<p><br></p>';
  };

  proto._inlineToHtml = function(text) {
    if (!text) return '';
    // Bold+italic
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic (single * or _)
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Link
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Line break (two spaces or explicit \n in paragraph)
    text = text.replace(/\n/g, '<br>');
    return text;
  };

  proto._escHtml = function(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  proto._escAttr = function(str) {
    return str.replace(/"/g, '&quot;');
  };


  // ─── HTML → Markdown ────────────────────────────────────────────────────────

  proto.htmlToMd = function(html) {
    if (!html || !html.trim()) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return this._nodeToMd(div).trim();
  };

  proto._nodeToMd = function(node) {
    let out = '';
    for (const child of node.childNodes) {
      out += this._blockNodeToMd(child);
    }
    return out;
  };

  proto._blockNodeToMd = function(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent;
      return t === '\n' ? '' : t;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();

    switch (tag) {
      case 'h1': return `# ${this._inlineNodeToMd(node)}\n\n`;
      case 'h2': return `## ${this._inlineNodeToMd(node)}\n\n`;
      case 'h3': return `### ${this._inlineNodeToMd(node)}\n\n`;
      case 'h4': return `#### ${this._inlineNodeToMd(node)}\n\n`;

      case 'p': {
        const content = this._inlineNodeToMd(node);
        if (!content || content === '\u200B') return '';
        return content + '\n\n';
      }

      case 'blockquote': {
        const inner = this._inlineNodeToMd(node).trim();
        return `> ${inner}\n\n`;
      }

      case 'pre': {
        const codeEl = node.querySelector('code');
        const lang = node.dataset.lang || '';
        const code = codeEl ? codeEl.textContent : node.textContent;
        return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
      }

      case 'hr': return `---\n\n`;

      case 'ul': {
        // Distinguish task list from regular list
        const isTaskList = node.classList.contains('task-list');
        let out = '';
        for (const li of node.querySelectorAll(':scope > li')) {
          if (isTaskList || li.classList.contains('task-item')) {
            const checkbox = li.querySelector('input[type="checkbox"]');
            const checked = checkbox ? checkbox.checked : false;
            const span = li.querySelector('span');
            const text = span ? this._inlineNodeToMd(span) : this._inlineNodeToMd(li);
            out += `- [${checked ? 'x' : ' '}] ${text}\n`;
          } else {
            out += `- ${this._inlineNodeToMd(li)}\n`;
          }
        }
        return out + '\n';
      }

      case 'ol': {
        let out = '';
        let n = 1;
        for (const li of node.querySelectorAll(':scope > li')) {
          out += `${n}. ${this._inlineNodeToMd(li)}\n`;
          n++;
        }
        return out + '\n';
      }

      case 'br': return '\n';

      case 'div': {
        // Generic div — recurse
        let out = '';
        for (const child of node.childNodes) {
          out += this._blockNodeToMd(child);
        }
        return out;
      }

      default:
        // Inline elements that somehow end up at block level
        return this._inlineNodeToMd(node) + '\n';
    }
  };

  proto._inlineNodeToMd = function(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const inner = Array.from(node.childNodes).map(c => this._inlineNodeToMd(c)).join('');

    switch (tag) {
      case 'strong':
      case 'b': return `**${inner}**`;
      case 'em':
      case 'i': return `*${inner}*`;
      case 'del':
      case 's': return `~~${inner}~~`;
      case 'code': return `\`${inner}\``;
      case 'a': return `[${inner}](${node.href || '#'})`;
      case 'br': return '\n';
      case 'span': return inner;
      case 'li': return inner;
      // Zero-width space used as placeholder — strip it
      default: return inner;
    }
  };


  // ─── Editor Lifecycle ────────────────────────────────────────────────────────

  proto.initNoteEditor = function(el, initialMarkdown, onChangeCb) {
    if (!el) return;
    el._noteEditorInited = true;
    el._onChangeCb = onChangeCb || null;

    // Set initial content
    this.setNoteEditorContent(el, initialMarkdown || '');

    // Ensure at least one block
    if (!el.innerHTML.trim() || el.innerHTML === '<p><br></p>') {
      el.innerHTML = '<p><br></p>';
    }

    // Prevent default Enter/Backspace to give us full control
    el.addEventListener('keydown', (e) => this._editorKeydown(e, el));

    // Slash commands: watch for / at start of empty block
    el.addEventListener('input', (e) => {
      this._checkSlashCommand(el);
      if (el._onChangeCb) el._onChangeCb();
    });

    // Selection toolbar
    el.addEventListener('mouseup', () => setTimeout(() => this._checkSelectionToolbar(el), 10));
    el.addEventListener('keyup', () => setTimeout(() => this._checkSelectionToolbar(el), 10));

    // Bind checkbox changes inside the editor
    el.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        // Checkbox state changes are reflected in the DOM automatically
        // Just trigger onChangeCb for autosave
        if (el._onChangeCb) el._onChangeCb();
      }
    });

    // Prevent checkboxes from moving cursor to their position
    el.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') {
        e.stopPropagation();
        // Don't call preventDefault — we want the checkbox to toggle
      }
    });

    // Placeholder text
    this._updateEditorPlaceholder(el);
    el.addEventListener('input', () => this._updateEditorPlaceholder(el));
    el.addEventListener('focus', () => this._updateEditorPlaceholder(el));
    el.addEventListener('blur', () => this._updateEditorPlaceholder(el));
  };

  proto.setNoteEditorContent = function(el, markdown) {
    if (!el) return;
    el.innerHTML = this.mdToHtml(markdown || '');
    this._updateEditorPlaceholder(el);
  };

  proto.getNoteEditorContent = function(el) {
    if (!el) return '';
    return this.htmlToMd(el.innerHTML);
  };

  proto.clearNoteEditor = function(el) {
    if (!el) return;
    el.innerHTML = '<p><br></p>';
    this._updateEditorPlaceholder(el);
  };

  proto._updateEditorPlaceholder = function(el) {
    const isEmpty = !el.textContent.trim() && !el.querySelector('img,input');
    el.classList.toggle('note-editor-empty', isEmpty);
  };


  // ─── Keyboard Handling ───────────────────────────────────────────────────────

  proto._editorKeydown = function(e, el) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._handleEnter(el);
    } else if (e.key === 'Backspace') {
      this._handleBackspace(e, el);
    } else if (e.key === 'Escape') {
      this._hideSlashMenu();
      this._hideSelectionToolbar();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Indent list items
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  proto._handleEnter = function(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // Find the current block element
    const block = this._getContainerBlock(range.startContainer, el);
    if (!block) {
      document.execCommand('insertParagraph', false, null);
      return;
    }

    const tag = block.tagName.toLowerCase();

    // Inside a task list
    if (block.tagName === 'LI' && block.classList.contains('task-item')) {
      const span = block.querySelector('span');
      const text = span ? span.textContent.trim() : block.textContent.trim();
      // If current item is empty, exit list
      if (!text) {
        const list = block.closest('ul.task-list');
        block.remove();
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        if (list && list.parentNode) {
          list.parentNode.insertBefore(p, list.nextSibling);
        } else {
          el.appendChild(p);
        }
        this._setCaret(p, 0);
        return;
      }
      // Create new task item
      const newLi = document.createElement('li');
      newLi.className = 'task-item';
      newLi.innerHTML = '<input type="checkbox"><span>\u200B</span>';
      block.after(newLi);
      const newSpan = newLi.querySelector('span');
      this._setCaret(newSpan, 0);
      return;
    }

    // Inside a regular list item
    if (block.tagName === 'LI') {
      const text = block.textContent.trim();
      if (!text) {
        // Exit list
        const list = block.closest('ul, ol');
        block.remove();
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        if (list && list.parentNode) {
          list.parentNode.insertBefore(p, list.nextSibling);
        } else {
          el.appendChild(p);
        }
        this._setCaret(p, 0);
        return;
      }
      const newLi = document.createElement('li');
      newLi.innerHTML = '<br>';
      block.after(newLi);
      this._setCaret(newLi, 0);
      return;
    }

    // Heading → new paragraph after
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      block.after(p);
      this._setCaret(p, 0);
      return;
    }

    // Blockquote → check if empty, exit; else new paragraph
    if (tag === 'blockquote') {
      const text = block.textContent.trim();
      if (!text) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.after(p);
        block.remove();
        this._setCaret(p, 0);
        return;
      }
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      block.after(p);
      this._setCaret(p, 0);
      return;
    }

    // Default: split paragraph or insert new paragraph
    document.execCommand('insertParagraph', false, null);

    // Clean up any empty <br> paragraphs created by browser
    setTimeout(() => {
      el.querySelectorAll('p:empty').forEach(p => { p.innerHTML = '<br>'; });
    }, 0);
  };

  proto._handleBackspace = function(e, el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // Only intercept at start of block with no selection
    if (!range.collapsed) return;
    if (range.startOffset !== 0) return;

    const block = this._getContainerBlock(range.startContainer, el);
    if (!block) return;
    const tag = block.tagName.toLowerCase();

    // At start of paragraph: convert to plain paragraph or merge with previous
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'blockquote') {
      e.preventDefault();
      const p = document.createElement('p');
      p.innerHTML = block.innerHTML || '<br>';
      block.replaceWith(p);
      this._setCaret(p, 0);
      return;
    }

    // If it's the only block, don't delete it
    const blocks = el.querySelectorAll(':scope > *');
    if (blocks.length === 1) {
      e.preventDefault();
      block.innerHTML = '<br>';
      this._setCaret(block, 0);
    }
  };

  proto._getContainerBlock = function(node, editor) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (el && el !== editor) {
      if (el.parentNode === editor) return el;
      el = el.parentNode;
    }
    return null;
  };

  proto._setCaret = function(el, offset) {
    const sel = window.getSelection();
    const range = document.createRange();
    try {
      if (el.childNodes.length === 0) {
        range.setStart(el, 0);
      } else if (el.childNodes[0].nodeType === Node.TEXT_NODE) {
        range.setStart(el.childNodes[0], Math.min(offset, el.childNodes[0].length));
      } else {
        range.setStart(el, 0);
      }
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) {
      // Fallback: just focus the element
      el.focus();
    }
  };


  // ─── Slash Command Menu ──────────────────────────────────────────────────────

  proto._checkSlashCommand = function(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const block = this._getContainerBlock(range.startContainer, el);
    if (!block) { this._hideSlashMenu(); return; }

    const text = block.textContent;

    // Show slash menu if block contains only '/'
    if (text === '/') {
      this._showSlashMenu(el, block);
    } else {
      this._hideSlashMenu();
    }
  };

  proto._showSlashMenu = function(editor, block) {
    let menu = document.getElementById('note-slash-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'note-slash-menu';
      menu.className = 'note-slash-menu';
      menu.innerHTML = `
        <div class="slash-menu-item" data-type="heading">
          <span class="slash-menu-icon">H₁</span><span>Heading</span>
        </div>
        <div class="slash-menu-item" data-type="task">
          <span class="slash-menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </span><span>To-do</span>
        </div>
        <div class="slash-menu-item" data-type="bullet">
          <span class="slash-menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/></svg>
          </span><span>Bullet list</span>
        </div>
        <div class="slash-menu-item" data-type="quote">
          <span class="slash-menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"/></svg>
          </span><span>Quote</span>
        </div>
        <div class="slash-menu-item" data-type="code">
          <span class="slash-menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </span><span>Code block</span>
        </div>
        <div class="slash-menu-item" data-type="divider">
          <span class="slash-menu-icon">—</span><span>Divider</span>
        </div>
      `;
      document.body.appendChild(menu);

      menu.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Don't blur the editor
        const item = e.target.closest('.slash-menu-item');
        if (item) {
          this._applySlashCommand(editor, block, item.dataset.type);
        }
        this._hideSlashMenu();
      });
    }

    // Position near the block
    const rect = block.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.classList.remove('hidden');
    menu.style.display = '';
    menu._activeBlock = block;
    menu._activeEditor = editor;

    // Store reference for keyboard nav
    this._slashMenuActive = true;
    this._slashMenuBlock = block;
    this._slashMenuEditor = editor;
  };

  proto._hideSlashMenu = function() {
    const menu = document.getElementById('note-slash-menu');
    if (menu) menu.style.display = 'none';
    this._slashMenuActive = false;
  };

  proto._applySlashCommand = function(editor, block, type) {
    // Replace the current block (which contains '/') with the new block type
    let newEl;
    switch (type) {
      case 'heading':
        newEl = document.createElement('h2');
        newEl.innerHTML = '<br>';
        break;
      case 'task': {
        const ul = document.createElement('ul');
        ul.className = 'task-list';
        const li = document.createElement('li');
        li.className = 'task-item';
        li.innerHTML = '<input type="checkbox"><span>\u200B</span>';
        ul.appendChild(li);
        block.replaceWith(ul);
        this._setCaret(li.querySelector('span'), 0);
        if (editor._onChangeCb) editor._onChangeCb();
        return;
      }
      case 'bullet': {
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        ul.appendChild(li);
        block.replaceWith(ul);
        this._setCaret(li, 0);
        if (editor._onChangeCb) editor._onChangeCb();
        return;
      }
      case 'quote':
        newEl = document.createElement('blockquote');
        newEl.innerHTML = '<br>';
        break;
      case 'code': {
        const pre = document.createElement('pre');
        pre.dataset.lang = '';
        const code = document.createElement('code');
        code.textContent = '\u200B';
        pre.appendChild(code);
        block.replaceWith(pre);
        this._setCaret(code, 0);
        if (editor._onChangeCb) editor._onChangeCb();
        return;
      }
      case 'divider': {
        const hr = document.createElement('hr');
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.replaceWith(hr);
        hr.after(p);
        this._setCaret(p, 0);
        if (editor._onChangeCb) editor._onChangeCb();
        return;
      }
      default: return;
    }
    block.replaceWith(newEl);
    this._setCaret(newEl, 0);
    if (editor._onChangeCb) editor._onChangeCb();
  };


  // ─── Selection Formatting Toolbar ───────────────────────────────────────────

  proto._checkSelectionToolbar = function(editor) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      this._hideSelectionToolbar();
      return;
    }

    // Make sure selection is inside the editor
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      this._hideSelectionToolbar();
      return;
    }

    this._showSelectionToolbar(editor, range);
  };

  proto._showSelectionToolbar = function(editor, range) {
    let toolbar = document.getElementById('note-selection-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'note-selection-toolbar';
      toolbar.className = 'note-selection-toolbar';
      toolbar.innerHTML = `
        <button type="button" class="sel-toolbar-btn" data-cmd="bold" title="Bold">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button type="button" class="sel-toolbar-btn" data-cmd="italic" title="Italic">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button type="button" class="sel-toolbar-btn" data-cmd="strikeThrough" title="Strikethrough">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4s-5 1-5 4c0 2.5 2 3.5 5 4"/><path d="M8 18c0 0 1.5 2 4 2s5-1 5-4"/></svg>
        </button>
        <span class="sel-toolbar-sep"></span>
        <button type="button" class="sel-toolbar-btn" data-cmd="heading" title="Heading">H</button>
        <button type="button" class="sel-toolbar-btn" data-cmd="task" title="To-do">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </button>
      `;
      document.body.appendChild(toolbar);

      toolbar.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Preserve selection
        const btn = e.target.closest('.sel-toolbar-btn');
        if (!btn) return;
        const cmd = btn.dataset.cmd;
        this._applySelectionCommand(editor, cmd);
      });
    }

    // Position above the selection
    const rect = range.getBoundingClientRect();
    const tbWidth = 180;
    let left = rect.left + window.scrollX + (rect.width / 2) - (tbWidth / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - tbWidth - 8));
    toolbar.style.top = `${rect.top + window.scrollY - 44}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.display = 'flex';
    toolbar._activeEditor = editor;
  };

  proto._hideSelectionToolbar = function() {
    const toolbar = document.getElementById('note-selection-toolbar');
    if (toolbar) toolbar.style.display = 'none';
  };

  proto._applySelectionCommand = function(editor, cmd) {
    switch (cmd) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'strikeThrough':
        document.execCommand('strikeThrough', false, null);
        break;
      case 'heading': {
        // Wrap the selected block in h2
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const block = this._getContainerBlock(range.commonAncestorContainer, editor);
        if (block && block.tagName !== 'H2') {
          const h = document.createElement('h2');
          h.innerHTML = block.innerHTML;
          block.replaceWith(h);
        } else if (block && block.tagName === 'H2') {
          // Toggle back to paragraph
          const p = document.createElement('p');
          p.innerHTML = block.innerHTML;
          block.replaceWith(p);
        }
        break;
      }
      case 'task': {
        // Wrap current line in a task item
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const block = this._getContainerBlock(range.commonAncestorContainer, editor);
        if (block) {
          const ul = document.createElement('ul');
          ul.className = 'task-list';
          const li = document.createElement('li');
          li.className = 'task-item';
          li.innerHTML = `<input type="checkbox"><span>${block.textContent}</span>`;
          ul.appendChild(li);
          block.replaceWith(ul);
        }
        break;
      }
    }
    this._hideSelectionToolbar();
    if (editor._onChangeCb) editor._onChangeCb();
  };


  // ─── Toolbar Button Handlers (top bar) ───────────────────────────────────────

  proto.applyNoteFormat = function(editor, format) {
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const block = range ? this._getContainerBlock(range.startContainer, editor) : null;

    // Normalise aliases
    if (format === 'todo') format = 'task';

    switch (format) {
      case 'bold':
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        document.execCommand('italic', false, null);
        break;
      case 'heading': {
        if (block && block.tagName === 'H2') {
          const p = document.createElement('p');
          p.innerHTML = block.innerHTML;
          block.replaceWith(p);
        } else if (block) {
          const h = document.createElement('h2');
          h.innerHTML = block.innerHTML || '<br>';
          block.replaceWith(h);
          this._setCaret(h, 0);
        }
        break;
      }
      case 'bullet': {
        if (block) {
          const ul = document.createElement('ul');
          const li = document.createElement('li');
          li.innerHTML = block.textContent || '<br>';
          ul.appendChild(li);
          block.replaceWith(ul);
          this._setCaret(li, li.childNodes.length);
        }
        break;
      }
      case 'task': {
        if (block) {
          const ul = document.createElement('ul');
          ul.className = 'task-list';
          const li = document.createElement('li');
          li.className = 'task-item';
          const text = block.textContent || '';
          li.innerHTML = `<input type="checkbox"><span>${text || '\u200B'}</span>`;
          ul.appendChild(li);
          block.replaceWith(ul);
          const span = li.querySelector('span');
          this._setCaret(span, 0);
        }
        break;
      }
      case 'blockquote': {
        if (block) {
          const bq = document.createElement('blockquote');
          bq.innerHTML = block.innerHTML || '<br>';
          block.replaceWith(bq);
          this._setCaret(bq, 0);
        }
        break;
      }
      case 'code': {
        if (block) {
          const pre = document.createElement('pre');
          pre.dataset.lang = '';
          const code = document.createElement('code');
          code.textContent = block.textContent || '';
          pre.appendChild(code);
          block.replaceWith(pre);
          this._setCaret(code, 0);
        }
        break;
      }
      case 'divider': {
        if (block) {
          const hr = document.createElement('hr');
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          block.after(hr);
          hr.after(p);
          this._setCaret(p, 0);
        }
        break;
      }
    }
    if (editor._onChangeCb) editor._onChangeCb();
  };


  // ─── Global cleanup ──────────────────────────────────────────────────────────

  // Close menus when clicking outside
  proto.bindNoteEditorGlobalEvents = function() {
    document.addEventListener('mousedown', (e) => {
      const menu = document.getElementById('note-slash-menu');
      if (menu && !menu.contains(e.target)) {
        this._hideSlashMenu();
      }
      const toolbar = document.getElementById('note-selection-toolbar');
      if (toolbar && !toolbar.contains(e.target) && !e.target.closest('.note-wysiwyg-editor')) {
        this._hideSelectionToolbar();
      }
    });
  };
}
