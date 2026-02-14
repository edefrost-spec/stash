export function applyCanvasMixin(proto) {

  // ===================================
  // Type Icons (inline SVG strings)
  // ===================================

  proto.getCanvasTypeIconSvg = function(saveType) {
    const icons = {
      article:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      book:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      video:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
      image:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      product:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
      music:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      highlight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>`,
      note:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      link:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      voice:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    };
    return icons[saveType] || icons.article;
  };

  // ===================================
  // Bootstrap
  // ===================================

  proto.bindCanvasTab = function() {
    // bindNavTabs in spaces.js now handles data-view="canvas" → setView('canvas')
    // setView('canvas') in views.js calls this.showCanvasPage()
    // We just need to bind the canvas toolbar / picker once here.
    // (Done lazily in showCanvasPage on first render.)
  };

  proto.showCanvasPage = function() {
    if (this._canvasInitialized) return;

    // Set up all canvas interactions (one time only)
    this.renderCanvas();

    // Wait for saves to be loaded before fetching canvas data
    if (this.saves && this.saves.length > 0) {
      this.loadCanvasData();
    } else {
      // Poll until saves are available
      const poll = setInterval(() => {
        if (this.saves && this.saves.length > 0) {
          clearInterval(poll);
          this.loadCanvasData();
        }
      }, 200);
    }

    this._canvasInitialized = true;
  };

  proto.renderCanvas = function() {
    this.initCanvasPanZoom();
    this.initCanvasDrag();
    this.initConnectionDrawing();
    this.bindCanvasToolbar();
    this.bindSavePickerPanel();
  };

  // ===================================
  // Transform helpers
  // ===================================

  proto.applyCanvasTransform = function() {
    const world = document.getElementById('canvas-world');
    if (!world) return;
    world.style.transform = `translate(${this.canvasPan.x}px, ${this.canvasPan.y}px) scale(${this.canvasZoom})`;
  };

  proto.viewportToWorld = function(clientX, clientY) {
    const viewport = document.getElementById('canvas-viewport');
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.canvasPan.x) / this.canvasZoom,
      y: (clientY - rect.top  - this.canvasPan.y) / this.canvasZoom,
    };
  };

  proto.updateZoomLabel = function() {
    const label = document.getElementById('canvas-zoom-label');
    if (label) label.textContent = `${Math.round(this.canvasZoom * 100)}%`;
  };

  // ===================================
  // Pan & Zoom
  // ===================================

  proto.initCanvasPanZoom = function() {
    const viewport = document.getElementById('canvas-viewport');
    if (!viewport) return;

    viewport.addEventListener('pointerdown', (e) => {
      // Only pan on direct viewport/world clicks, not nodes or panels
      if (e.target.closest('.canvas-node')) return;
      if (e.target.closest('.canvas-picker-panel')) return;
      if (e.target.closest('.canvas-toolbar')) return;

      this.deselectEdge();

      this.canvasPanState = {
        startX: e.clientX - this.canvasPan.x,
        startY: e.clientY - this.canvasPan.y,
      };
      viewport.classList.add('canvas--panning');
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!this.canvasPanState) return;
      this.canvasPan.x = e.clientX - this.canvasPanState.startX;
      this.canvasPan.y = e.clientY - this.canvasPanState.startY;
      this.applyCanvasTransform();
    });

    viewport.addEventListener('pointerup', () => {
      this.canvasPanState = null;
      viewport.classList.remove('canvas--panning');
    });

    viewport.addEventListener('pointercancel', () => {
      this.canvasPanState = null;
      viewport.classList.remove('canvas--panning');
    });

    // Zoom toward cursor
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(2, Math.max(0.3, this.canvasZoom * delta));
      const zoomRatio = newZoom / this.canvasZoom;

      this.canvasPan.x = mouseX - zoomRatio * (mouseX - this.canvasPan.x);
      this.canvasPan.y = mouseY - zoomRatio * (mouseY - this.canvasPan.y);
      this.canvasZoom = newZoom;

      this.applyCanvasTransform();
      this.updateZoomLabel();
    }, { passive: false });

    // Double-click on empty canvas → add stem
    viewport.addEventListener('dblclick', (e) => {
      if (e.target.closest('.canvas-node')) return;
      if (e.target.closest('.canvas-picker-panel')) return;
      if (e.target.closest('.canvas-toolbar')) return;
      const worldPos = this.viewportToWorld(e.clientX, e.clientY);
      this.addStemToCanvas(worldPos.x - 90, worldPos.y - 40, '');
    });
  };

  // ===================================
  // Data Loading
  // ===================================

  proto.loadCanvasData = async function() {
    const [nodesResult, edgesResult] = await Promise.all([
      this.supabase
        .from('canvas_nodes')
        .select('*')
        .eq('user_id', this.user.id)
        .order('created_at'),

      this.supabase
        .from('canvas_edges')
        .select('*')
        .eq('user_id', this.user.id),
    ]);

    this.canvasNodes = nodesResult.data || [];
    this.canvasEdges = edgesResult.data || [];

    this.renderCanvasNodes();
    this.renderCanvasEdges();
    this.updateCanvasEmptyHint();
  };

  // ===================================
  // Node Rendering
  // ===================================

  proto.renderCanvasNodes = function() {
    const layer = document.getElementById('canvas-nodes-layer');
    if (!layer) return;
    layer.innerHTML = '';
    this.canvasNodes.forEach(node => {
      layer.appendChild(this.buildNodeElement(node));
    });
  };

  proto.buildNodeElement = function(node) {
    const el = document.createElement('div');
    const isStem = !node.save_id;
    el.className = `canvas-node ${isStem ? 'canvas-stem-node' : 'canvas-save-node'}`;
    el.dataset.nodeId = node.id;
    el.style.transform = `translate(${node.x}px, ${node.y}px)`;
    el.style.width = `${node.width || 200}px`;

    // Connection handle (top-center dot)
    const handle = document.createElement('div');
    handle.className = 'canvas-node-handle canvas-node-handle--top';
    el.appendChild(handle);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'canvas-node-delete';
    delBtn.type = 'button';
    delBtn.title = 'Remove from canvas';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeNode(node.id);
    });
    el.appendChild(delBtn);

    if (isStem) {
      // Stem node: editable textarea
      const inner = document.createElement('div');
      inner.className = 'canvas-node-inner';

      const ta = document.createElement('textarea');
      ta.className = 'canvas-stem-text';
      ta.placeholder = 'Type a note...';
      ta.value = node.text || '';
      ta.rows = 4;

      // Debounced save
      let stemTimer;
      ta.addEventListener('input', () => {
        clearTimeout(stemTimer);
        stemTimer = setTimeout(() => {
          this.updateStemText(node.id, ta.value);
        }, 800);
      });

      // Prevent canvas drag/pan when interacting with textarea
      ta.addEventListener('pointerdown', (e) => e.stopPropagation());
      ta.addEventListener('mousedown', (e) => e.stopPropagation());

      inner.appendChild(ta);
      el.appendChild(inner);

    } else {
      // Save node
      const save = this.saves.find(s => s.id === node.save_id);
      const inner = document.createElement('div');
      inner.className = 'canvas-node-inner';

      if (save) {
        const saveType = this.getSaveType(save);
        const iconSvg = this.getCanvasTypeIconSvg(saveType);

        if (save.image_url) {
          const thumb = document.createElement('div');
          thumb.className = 'canvas-node-thumb';
          const img = document.createElement('img');
          img.src = save.image_url;
          img.alt = '';
          img.loading = 'lazy';
          thumb.appendChild(img);
          inner.appendChild(thumb);
        }

        const meta = document.createElement('div');
        meta.className = 'canvas-node-meta';

        const typeIcon = document.createElement('span');
        typeIcon.className = 'canvas-node-type-icon';
        typeIcon.innerHTML = iconSvg;

        const title = document.createElement('span');
        title.className = 'canvas-node-title';
        title.textContent = save.title || 'Untitled';

        if (save.site_name) {
          const site = document.createElement('span');
          site.className = 'canvas-node-site';
          site.textContent = save.site_name;
          meta.appendChild(typeIcon);
          meta.appendChild(title);
          meta.appendChild(site);
        } else {
          meta.appendChild(typeIcon);
          meta.appendChild(title);
        }

        inner.appendChild(meta);

        // Click to open reading pane (guarded by drag detection)
        inner.addEventListener('click', () => {
          if (this._nodeWasDragged) return;
          if (this.openReadingPane) {
            this.openReadingPane(save);
          } else if (this.openUnifiedModal) {
            this.openUnifiedModal(save);
          }
        });

      } else {
        // Save no longer found (may be deleted)
        const title = document.createElement('span');
        title.className = 'canvas-node-title canvas-node-title--missing';
        title.textContent = 'Deleted save';
        inner.appendChild(title);
      }

      el.appendChild(inner);
    }

    return el;
  };

  // ===================================
  // Edge Rendering
  // ===================================

  proto.renderCanvasEdges = function() {
    const svg = document.getElementById('canvas-svg');
    if (!svg) return;

    // Remove existing edges (keep <defs>)
    svg.querySelectorAll('.canvas-edge, .canvas-edge-temp').forEach(el => el.remove());

    this.canvasEdges.forEach(edge => {
      const sourceNode = this.canvasNodes.find(n => n.id === edge.source_node_id);
      const targetNode = this.canvasNodes.find(n => n.id === edge.target_node_id);
      if (!sourceNode || !targetNode) return;
      svg.appendChild(this.buildEdgePath(edge, sourceNode, targetNode));
    });
  };

  proto.buildEdgePath = function(edge, sourceNode, targetNode) {
    const sw = sourceNode.width || 200;
    const tw = targetNode.width || 200;
    const NODE_H = 60; // rough node height estimate for bezier anchor

    const x1 = sourceNode.x + sw / 2;
    const y1 = sourceNode.y + NODE_H;
    const x2 = targetNode.x + tw / 2;
    const y2 = targetNode.y;

    const cy = Math.max(40, Math.abs(y2 - y1) * 0.5);
    const d = `M ${x1},${y1} C ${x1},${y1 + cy} ${x2},${y2 - cy} ${x2},${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'canvas-edge');
    path.dataset.edgeId = edge.id;
    path.setAttribute('stroke', 'var(--text-muted)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#canvas-arrow)');

    if (edge.id === this.canvasSelectedEdgeId) {
      path.classList.add('canvas-edge--selected');
    }

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectEdge(edge.id);
    });

    return path;
  };

  proto.selectEdge = function(edgeId) {
    this.canvasSelectedEdgeId = edgeId;
    document.querySelectorAll('.canvas-edge').forEach(el => {
      el.classList.toggle('canvas-edge--selected', el.dataset.edgeId === edgeId);
    });
  };

  proto.deselectEdge = function() {
    this.canvasSelectedEdgeId = null;
    document.querySelectorAll('.canvas-edge').forEach(el => {
      el.classList.remove('canvas-edge--selected');
    });
  };

  // ===================================
  // Node Drag (pointer events)
  // ===================================

  proto.initCanvasDrag = function() {
    const layer = document.getElementById('canvas-nodes-layer');
    if (!layer) return;

    layer.addEventListener('pointerdown', (e) => {
      const nodeEl = e.target.closest('.canvas-node');
      if (!nodeEl) return;
      if (e.target.closest('.canvas-node-delete')) return;
      if (e.target.closest('.canvas-node-handle')) return;
      if (e.target.closest('textarea')) return;

      e.stopPropagation();

      const nodeId = nodeEl.dataset.nodeId;
      const node = this.canvasNodes.find(n => n.id === nodeId);
      if (!node) return;

      this._nodeWasDragged = false;

      this.canvasDragState = {
        nodeId,
        nodeEl,
        startNodeX: node.x,
        startNodeY: node.y,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };

      nodeEl.classList.add('canvas-node--dragging');
      layer.setPointerCapture(e.pointerId);
    });

    layer.addEventListener('pointermove', (e) => {
      if (!this.canvasDragState) return;

      const dx = (e.clientX - this.canvasDragState.startClientX) / this.canvasZoom;
      const dy = (e.clientY - this.canvasDragState.startClientY) / this.canvasZoom;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this._nodeWasDragged = true;
      }

      const node = this.canvasNodes.find(n => n.id === this.canvasDragState.nodeId);
      if (!node) return;

      node.x = this.canvasDragState.startNodeX + dx;
      node.y = this.canvasDragState.startNodeY + dy;

      this.canvasDragState.nodeEl.style.transform = `translate(${node.x}px, ${node.y}px)`;
      this.renderCanvasEdges();
    });

    layer.addEventListener('pointerup', () => {
      if (!this.canvasDragState) return;
      this.canvasDragState.nodeEl.classList.remove('canvas-node--dragging');

      const node = this.canvasNodes.find(n => n.id === this.canvasDragState.nodeId);
      if (node && this._nodeWasDragged) {
        this.updateNodePosition(node.id, node.x, node.y);
      }

      this.canvasDragState = null;
      // Reset _nodeWasDragged after a tick so click handler sees it
      setTimeout(() => { this._nodeWasDragged = false; }, 0);
    });

    layer.addEventListener('pointercancel', () => {
      if (this.canvasDragState) {
        this.canvasDragState.nodeEl.classList.remove('canvas-node--dragging');
        this.canvasDragState = null;
      }
    });
  };

  // ===================================
  // Connection Drawing
  // ===================================

  proto.initConnectionDrawing = function() {
    const layer = document.getElementById('canvas-nodes-layer');
    if (!layer) return;

    layer.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.canvas-node-handle');
      if (!handle) return;

      e.stopPropagation();
      e.preventDefault();

      const nodeEl = handle.closest('.canvas-node');
      const sourceId = nodeEl?.dataset.nodeId;
      if (!sourceId) return;

      const sourceNode = this.canvasNodes.find(n => n.id === sourceId);
      if (!sourceNode) return;

      const svg = document.getElementById('canvas-svg');
      const sx = sourceNode.x + (sourceNode.width || 200) / 2;
      const sy = sourceNode.y + 60;

      const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.setAttribute('class', 'canvas-edge-temp');
      tempLine.setAttribute('stroke', 'var(--primary)');
      tempLine.setAttribute('stroke-width', '1.5');
      tempLine.setAttribute('stroke-dasharray', '6,3');
      tempLine.setAttribute('x1', sx);
      tempLine.setAttribute('y1', sy);
      tempLine.setAttribute('x2', sx);
      tempLine.setAttribute('y2', sy);
      svg.appendChild(tempLine);

      this.canvasConnecting = { sourceId, tempLine };
      layer.setPointerCapture(e.pointerId);
    });

    layer.addEventListener('pointermove', (e) => {
      if (!this.canvasConnecting) return;
      const worldPos = this.viewportToWorld(e.clientX, e.clientY);
      this.canvasConnecting.tempLine.setAttribute('x2', worldPos.x);
      this.canvasConnecting.tempLine.setAttribute('y2', worldPos.y);
    });

    layer.addEventListener('pointerup', (e) => {
      if (!this.canvasConnecting) return;

      this.canvasConnecting.tempLine.remove();

      // Find the node element under the release point
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      const targetNodeEl = elementsUnder.find(el =>
        el.classList && el.classList.contains('canvas-node') &&
        el.dataset.nodeId !== this.canvasConnecting.sourceId
      );

      if (targetNodeEl) {
        this.addEdge(this.canvasConnecting.sourceId, targetNodeEl.dataset.nodeId);
      }

      this.canvasConnecting = null;
    });

    layer.addEventListener('pointercancel', () => {
      if (this.canvasConnecting) {
        this.canvasConnecting.tempLine.remove();
        this.canvasConnecting = null;
      }
    });
  };

  // ===================================
  // Toolbar
  // ===================================

  proto.bindCanvasToolbar = function() {
    document.getElementById('canvas-add-stem-btn')?.addEventListener('click', () => {
      const viewport = document.getElementById('canvas-viewport');
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const center = this.viewportToWorld(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      this.addStemToCanvas(center.x - 90, center.y - 40, '');
    });

    document.getElementById('canvas-picker-btn')?.addEventListener('click', () => {
      this.openSavePickerPanel();
    });

    document.getElementById('canvas-zoom-in')?.addEventListener('click', () => {
      this.canvasZoom = Math.min(2, this.canvasZoom * 1.2);
      this.applyCanvasTransform();
      this.updateZoomLabel();
    });

    document.getElementById('canvas-zoom-out')?.addEventListener('click', () => {
      this.canvasZoom = Math.max(0.3, this.canvasZoom / 1.2);
      this.applyCanvasTransform();
      this.updateZoomLabel();
    });

    document.getElementById('canvas-zoom-reset')?.addEventListener('click', () => {
      this.canvasZoom = 1;
      this.canvasPan = { x: 0, y: 0 };
      this.applyCanvasTransform();
      this.updateZoomLabel();
    });

    // Delete key removes selected edge (only when canvas is active)
    document.addEventListener('keydown', (e) => {
      if (this.currentView !== 'canvas') return;
      if (!this.canvasSelectedEdgeId) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.removeEdge(this.canvasSelectedEdgeId);
        this.canvasSelectedEdgeId = null;
      }
    });
  };

  // ===================================
  // Save Picker Panel
  // ===================================

  proto.openSavePickerPanel = function() {
    const panel = document.getElementById('canvas-picker-panel');
    panel?.classList.remove('hidden');
    const input = document.getElementById('canvas-picker-search-input');
    if (input) input.value = '';
    this.renderSavePickerList('');
  };

  proto.closeSavePickerPanel = function() {
    document.getElementById('canvas-picker-panel')?.classList.add('hidden');
  };

  proto.bindSavePickerPanel = function() {
    document.getElementById('canvas-picker-close')?.addEventListener('click', () => {
      this.closeSavePickerPanel();
    });

    document.getElementById('canvas-picker-search-input')?.addEventListener('input', (e) => {
      this.renderSavePickerList(e.target.value.trim());
    });

    // Bind the viewport as a drop target for picker items (HTML drag API)
    const viewport = document.getElementById('canvas-viewport');
    if (viewport && !viewport._canvasDropBound) {
      viewport._canvasDropBound = true;

      viewport.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('canvas-save-id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      });

      viewport.addEventListener('drop', (e) => {
        const saveId = e.dataTransfer.getData('canvas-save-id');
        if (!saveId) return;
        e.preventDefault();
        const worldPos = this.viewportToWorld(e.clientX, e.clientY);
        this.addSaveToCanvas(saveId, worldPos.x - 100, worldPos.y - 30);
      });
    }
  };

  proto.renderSavePickerList = function(query = '') {
    const list = document.getElementById('canvas-picker-list');
    if (!list) return;

    const onCanvasIds = new Set(
      this.canvasNodes.map(n => n.save_id).filter(Boolean)
    );

    let saves = this.saves || [];
    if (query) {
      const q = query.toLowerCase();
      saves = saves.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.site_name || '').toLowerCase().includes(q)
      );
    }

    if (saves.length === 0) {
      list.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">${query ? 'No results' : 'No saves yet'}</div>`;
      return;
    }

    list.innerHTML = saves.map(save => {
      const onCanvas = onCanvasIds.has(save.id);
      const thumb = save.image_url
        ? `<img class="canvas-picker-thumb" src="${save.image_url}" alt="" loading="lazy">`
        : `<div class="canvas-picker-thumb canvas-picker-thumb--placeholder"></div>`;
      const badge = onCanvas
        ? `<span class="canvas-picker-badge">On canvas</span>`
        : `<button class="canvas-picker-add-btn" data-save-id="${save.id}" type="button">Add</button>`;

      return `
        <div class="canvas-picker-item${onCanvas ? ' canvas-picker-item--on-canvas' : ''}"
             data-save-id="${save.id}"
             draggable="${onCanvas ? 'false' : 'true'}">
          ${thumb}
          <div class="canvas-picker-info">
            <div class="canvas-picker-title">${this.escapeHtml(save.title || 'Untitled')}</div>
            <div class="canvas-picker-site">${this.escapeHtml(save.site_name || '')}</div>
          </div>
          ${badge}
        </div>
      `;
    }).join('');

    // "Add" button clicks
    list.querySelectorAll('.canvas-picker-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const saveId = btn.dataset.saveId;
        const viewport = document.getElementById('canvas-viewport');
        const rect = viewport?.getBoundingClientRect() || { left: 0, top: 0, width: 600, height: 400 };
        const offset = (Math.random() - 0.5) * 120;
        const center = this.viewportToWorld(
          rect.left + rect.width / 2 + offset,
          rect.top + rect.height / 2 + offset
        );
        this.addSaveToCanvas(saveId, center.x - 100, center.y - 30);
      });
    });

    // Drag from picker onto canvas (HTML drag API)
    list.querySelectorAll('.canvas-picker-item[draggable="true"]').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('canvas-save-id', item.dataset.saveId);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  };

  // ===================================
  // Supabase CRUD
  // ===================================

  proto.addSaveToCanvas = async function(saveId, x, y) {
    // Prevent duplicate
    if (this.canvasNodes.find(n => n.save_id === saveId)) {
      return;
    }

    const { data, error } = await this.supabase
      .from('canvas_nodes')
      .insert({ user_id: this.user.id, save_id: saveId, x, y, width: 200 })
      .select()
      .single();

    if (error) { console.error('Canvas: addSaveToCanvas error', error); return; }

    this.canvasNodes.push(data);
    const layer = document.getElementById('canvas-nodes-layer');
    layer?.appendChild(this.buildNodeElement(data));
    this.updateCanvasEmptyHint();
    this.renderSavePickerList(
      document.getElementById('canvas-picker-search-input')?.value || ''
    );
  };

  proto.addStemToCanvas = async function(x, y, text) {
    const { data, error } = await this.supabase
      .from('canvas_nodes')
      .insert({ user_id: this.user.id, save_id: null, x, y, width: 200, text: text || '' })
      .select()
      .single();

    if (error) { console.error('Canvas: addStemToCanvas error', error); return; }

    this.canvasNodes.push(data);
    const layer = document.getElementById('canvas-nodes-layer');
    if (layer) {
      const el = this.buildNodeElement(data);
      layer.appendChild(el);
      // Auto-focus textarea
      el.querySelector('textarea')?.focus();
    }
    this.updateCanvasEmptyHint();
  };

  proto.updateNodePosition = async function(nodeId, x, y) {
    await this.supabase
      .from('canvas_nodes')
      .update({ x, y })
      .eq('id', nodeId)
      .eq('user_id', this.user.id);
  };

  proto.updateStemText = async function(nodeId, text) {
    const node = this.canvasNodes.find(n => n.id === nodeId);
    if (node) node.text = text;

    await this.supabase
      .from('canvas_nodes')
      .update({ text })
      .eq('id', nodeId)
      .eq('user_id', this.user.id);
  };

  proto.addEdge = async function(sourceId, targetId) {
    // Prevent duplicate edges (both directions)
    const exists = this.canvasEdges.find(e =>
      (e.source_node_id === sourceId && e.target_node_id === targetId) ||
      (e.source_node_id === targetId && e.target_node_id === sourceId)
    );
    if (exists) return;

    const { data, error } = await this.supabase
      .from('canvas_edges')
      .insert({ user_id: this.user.id, source_node_id: sourceId, target_node_id: targetId })
      .select()
      .single();

    if (error) { console.error('Canvas: addEdge error', error); return; }

    this.canvasEdges.push(data);
    this.renderCanvasEdges();
  };

  proto.removeEdge = async function(edgeId) {
    await this.supabase
      .from('canvas_edges')
      .delete()
      .eq('id', edgeId)
      .eq('user_id', this.user.id);

    this.canvasEdges = this.canvasEdges.filter(e => e.id !== edgeId);
    this.renderCanvasEdges();
  };

  proto.removeNode = async function(nodeId) {
    // Delete from DB (FK cascade deletes its edges in DB too)
    await this.supabase
      .from('canvas_nodes')
      .delete()
      .eq('id', nodeId)
      .eq('user_id', this.user.id);

    // Clean local state
    this.canvasNodes = this.canvasNodes.filter(n => n.id !== nodeId);
    this.canvasEdges = this.canvasEdges.filter(e =>
      e.source_node_id !== nodeId && e.target_node_id !== nodeId
    );

    // Remove DOM element
    document.querySelector(`.canvas-node[data-node-id="${nodeId}"]`)?.remove();

    // Re-render edges and picker badges
    this.renderCanvasEdges();
    this.updateCanvasEmptyHint();
    this.renderSavePickerList(
      document.getElementById('canvas-picker-search-input')?.value || ''
    );
  };

  // ===================================
  // Empty State Hint
  // ===================================

  proto.updateCanvasEmptyHint = function() {
    const viewport = document.getElementById('canvas-viewport');
    if (!viewport) return;

    const existingHint = viewport.querySelector('.canvas-empty-hint');

    if (this.canvasNodes.length === 0) {
      if (!existingHint) {
        const hint = document.createElement('div');
        hint.className = 'canvas-empty-hint';
        hint.innerHTML = `
          <div class="canvas-empty-icon">⬡</div>
          <p>Your canvas is empty</p>
          <p>Click <strong>Add Save</strong> to place items here,<br>or double-click anywhere to add a note.</p>
        `;
        viewport.appendChild(hint);
      }
    } else {
      existingHint?.remove();
    }
  };

}
