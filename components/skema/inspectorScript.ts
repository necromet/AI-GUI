export const INSPECTOR_SCRIPT: string = `(function() {
  'use strict';

  var HOVER_BORDER = '#6366f1';
  var SELECT_BORDER = '#22c55e';
  var HOVER_BG = 'rgba(99,102,241,0.08)';
  var SELECT_BG = 'rgba(34,197,94,0.06)';
  var Z_HOVER = 2147483640;
  var Z_SELECT = 2147483641;
  var Z_LABEL = 2147483642;
  var MSG_PREFIX = '__skema__:';

  var hoverOverlay = null;
  var selectOverlay = null;
  var labelEl = null;
  var selectedEl = null;
  var hoveredEl = null;
  var editingEl = null;
  var syncTimer = null;
  var SYNC_DELAY = 600;

  function postToParent(type, data) {
    try {
      window.parent.postMessage(MSG_PREFIX + JSON.stringify({ type: type, data: data || {} }), '*');
    } catch(e) {}
  }

  function findTarget(e) {
    var el = e.target;
    while (el && el !== document.documentElement) {
      if (el.hasAttribute && el.hasAttribute('data-skema-inspector')) {
        return null;
      }
      el = el.parentNode;
    }
    return e.target;
  }

  function isInspectorEl(el) {
    while (el) {
      if (el.hasAttribute && el.hasAttribute('data-skema-inspector')) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      if (cur.id) {
        parts.unshift('#' + cur.id);
        break;
      }
      var tag = cur.tagName.toLowerCase();
      var nth = 1;
      var sib = cur.previousElementSibling;
      while (sib) {
        if (sib.tagName && sib.tagName.toLowerCase() === tag) {
          nth++;
        }
        sib = sib.previousElementSibling;
      }
      parts.unshift(tag + ':nth-of-type(' + nth + ')');
      cur = cur.parentNode;
    }
    return parts.join(' > ');
  }

  function findByPath(path) {
    if (!path) return null;
    try {
      return document.querySelector(path);
    } catch(e) {
      return null;
    }
  }

  function getElementInfo(el) {
    if (!el || el.nodeType !== 1) return null;
    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var textContent = (el.textContent || '').trim();
    if (textContent.length > 300) {
      textContent = textContent.substring(0, 300);
    }
    var className = (typeof el.className === 'string') ? el.className.trim() : '';
    if (className.length === 0) className = null;

    var textEditableTags = ['P','H1','H2','H3','H4','H5','H6','SPAN','A','LI','TD','TH','LABEL','BUTTON','STRONG','EM','B','I','SMALL','MARK','CODE','PRE'];
    var tagName = el.tagName.toUpperCase();
    var isTextEditable = textEditableTags.indexOf(tagName) !== -1;
    if (!isTextEditable && (tagName === 'DIV' || tagName === 'SECTION' || tagName === 'ARTICLE')) {
      var onlyText = true;
      var childCount = el.childNodes.length;
      if (childCount < 500) {
        for (var i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType !== 3 && el.childNodes[i].nodeType !== 1) {
            onlyText = false;
            break;
          }
          if (el.childNodes[i].nodeType === 1) {
            var childTag = el.childNodes[i].tagName.toUpperCase();
            if (textEditableTags.indexOf(childTag) === -1 && childTag !== 'BR') {
              onlyText = false;
              break;
            }
          }
        }
        if (onlyText && textContent.length <= 500) {
          isTextEditable = true;
        }
      }
    }

    return {
      tag: tagName.toLowerCase(),
      id: el.id || null,
      classes: className,
      text: textContent,
      path: cssPath(el),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        margin: cs.margin,
        borderRadius: cs.borderRadius,
        textAlign: cs.textAlign,
        display: cs.display,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textDecoration: cs.textDecoration,
        opacity: cs.opacity,
        border: cs.border,
        boxShadow: cs.boxShadow
      },
      isTextEditable: isTextEditable,
      childCount: el.childNodes.length
    };
  }

  function positionOverlay(overlay, el, borderColor, bgColor) {
    if (!overlay || !el) return;
    var rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.borderColor = borderColor;
    overlay.style.backgroundColor = bgColor;
  }

  function positionLabel(el) {
    if (!labelEl || !el) return;
    var rect = el.getBoundingClientRect();
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = '';
    if (typeof el.className === 'string' && el.className.trim()) {
      var firstClass = el.className.trim().split(/\\s+/)[0];
      if (firstClass) cls = '.' + firstClass;
    }
    labelEl.textContent = tag + id + cls;
    labelEl.style.display = 'block';
    var labelTop = rect.top - 24;
    if (labelTop < 0) labelTop = 0;
    labelEl.style.top = labelTop + 'px';
    labelEl.style.left = rect.left + 'px';
  }

  function hideOverlay(overlay) {
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function hideLabel() {
    if (labelEl) {
      labelEl.style.display = 'none';
    }
  }

  function updateSelectOverlay() {
    if (selectedEl) {
      positionOverlay(selectOverlay, selectedEl, SELECT_BORDER, SELECT_BG);
    }
  }

  function updateHoverOverlay() {
    if (hoveredEl) {
      positionOverlay(hoverOverlay, hoveredEl, HOVER_BORDER, HOVER_BG);
      positionLabel(hoveredEl);
    }
  }

  function createOverlay(attrValue, borderColor, bgColor, zIndex) {
    var div = document.createElement('div');
    div.setAttribute('data-skema-inspector', attrValue);
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '0';
    div.style.height = '0';
    div.style.border = '2px solid ' + borderColor;
    div.style.backgroundColor = bgColor;
    div.style.pointerEvents = 'none';
    div.style.zIndex = String(zIndex);
    div.style.display = 'none';
    div.style.margin = '0';
    div.style.padding = '0';
    div.style.boxSizing = 'border-box';
    return div;
  }

  function createLabel() {
    var div = document.createElement('div');
    div.setAttribute('data-skema-inspector', 'label');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.pointerEvents = 'none';
    div.style.zIndex = String(Z_LABEL);
    div.style.display = 'none';
    div.style.backgroundColor = '#312e81';
    div.style.color = '#e0e7ff';
    div.style.fontSize = '11px';
    div.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    div.style.padding = '2px 6px';
    div.style.borderRadius = '3px';
    div.style.whiteSpace = 'nowrap';
    div.style.lineHeight = '16px';
    div.style.margin = '0';
    div.style.boxSizing = 'border-box';
    return div;
  }

  function deselect() {
    selectedEl = null;
    hideOverlay(selectOverlay);
    postToParent('deselect', {});
  }

  function selectElement(el) {
    if (editingEl && editingEl === el) return;
    if (editingEl) stopEditing();
    selectedEl = el;
    positionOverlay(selectOverlay, el, SELECT_BORDER, SELECT_BG);
    postToParent('select', getElementInfo(el));
  }

  function isTextOnly(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType !== 3 && el.childNodes[i].nodeType !== 1) return false;
      if (el.childNodes[i].nodeType === 1) {
        var t = el.childNodes[i].tagName.toUpperCase();
        if (t !== 'BR') return false;
      }
    }
    return true;
  }

  function canEditText(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName.toUpperCase();
    var textTags = ['P','H1','H2','H3','H4','H5','H6','SPAN','A','LI','TD','TH','LABEL','BUTTON','STRONG','EM','B','I','SMALL','MARK','CODE','PRE'];
    if (textTags.indexOf(tag) !== -1) return true;
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') {
      var text = (el.textContent || '').trim();
      if (text.length <= 500 && isTextOnly(el)) return true;
    }
    return false;
  }

  function startEditing(el) {
    if (!el || editingEl === el) return;
    if (editingEl) stopEditing();
    editingEl = el;
    el.setAttribute('contenteditable', 'true');
    el.focus();
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch(e) {}
    postToParent('edit-start', getElementInfo(el));
  }

  function stopEditing() {
    if (!editingEl) return;
    var el = editingEl;
    editingEl = null;
    el.removeAttribute('contenteditable');
    postToParent('edit-end', {
      path: cssPath(el),
      text: (el.textContent || '').trim()
    });
    scheduleSync();
  }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function() {
      syncTimer = null;
      postToParent('mutate', { html: getCleanHtml() });
    }, SYNC_DELAY);
  }

  function getCleanHtml() {
    var clone = document.documentElement.cloneNode(true);
    var inspectors = clone.querySelectorAll('[data-skema-inspector]');
    for (var i = 0; i < inspectors.length; i++) {
      inspectors[i].parentNode.removeChild(inspectors[i]);
    }
    var editables = clone.querySelectorAll('[contenteditable]');
    for (var j = 0; j < editables.length; j++) {
      editables[j].removeAttribute('contenteditable');
    }
    var scripts = clone.querySelectorAll('script');
    for (var k = 0; k < scripts.length; k++) {
      if ((scripts[k].textContent || '').indexOf('__skema__') !== -1) {
        scripts[k].parentNode.removeChild(scripts[k]);
      }
    }
    return '<!DOCTYPE html>\\n' + clone.outerHTML;
  }

  function resolveElement(data) {
    if (data.path) {
      var el = findByPath(data.path);
      if (el) return el;
    }
    return null;
  }

  function handleParentMessage(e) {
    var msg = e.data;
    if (typeof msg !== 'string') return;
    if (msg.indexOf(MSG_PREFIX) !== 0) return;

    var json;
    try {
      json = JSON.parse(msg.substring(MSG_PREFIX.length));
    } catch(err) {
      return;
    }

    var type = json.type;
    var data = json.data || {};

    if (type === 'update-style') {
      var el = resolveElement(data);
      if (el && data.property) {
        el.style[data.property] = data.value || '';
        if (selectedEl === el) updateSelectOverlay();
      }
    } else if (type === 'update-text') {
      var el2 = resolveElement(data);
      if (el2 && typeof data.text === 'string') {
        el2.textContent = data.text;
        if (selectedEl === el2) updateSelectOverlay();
      }
    } else if (type === 'delete-element') {
      var el3 = resolveElement(data);
      if (el3) {
        if (selectedEl === el3) deselect();
        if (editingEl === el3) { editingEl = null; }
        el3.parentNode.removeChild(el3);
        scheduleSync();
      }
    } else if (type === 'duplicate-element') {
      var el4 = resolveElement(data);
      if (el4 && el4.parentNode) {
        var clone = el4.cloneNode(true);
        clone.removeAttribute('contenteditable');
        if (el4.nextSibling) {
          el4.parentNode.insertBefore(clone, el4.nextSibling);
        } else {
          el4.parentNode.appendChild(clone);
        }
        scheduleSync();
      }
    } else if (type === 'move-element') {
      var el5 = resolveElement(data);
      if (el5 && el5.parentNode) {
        var direction = data.direction;
        if (direction === 'up' && el5.previousElementSibling) {
          el5.parentNode.insertBefore(el5, el5.previousElementSibling);
          scheduleSync();
        } else if (direction === 'down' && el5.nextElementSibling) {
          if (el5.nextElementSibling.nextSibling) {
            el5.parentNode.insertBefore(el5, el5.nextElementSibling.nextSibling);
          } else {
            el5.parentNode.appendChild(el5);
          }
          scheduleSync();
        }
        if (selectedEl === el5) updateSelectOverlay();
      }
    } else if (type === 'set-attribute') {
      var el6 = resolveElement(data);
      if (el6 && data.attribute) {
        if (data.value === null || data.value === undefined || data.value === '') {
          el6.removeAttribute(data.attribute);
        } else {
          el6.setAttribute(data.attribute, data.value);
        }
        scheduleSync();
      }
    } else if (type === 'get-html') {
      postToParent('html-response', { html: getCleanHtml() });
    }
  }

  function onMouseOver(e) {
    var target = findTarget(e);
    if (!target) {
      var real = e.target;
      if (isInspectorEl(real)) return;
      target = real;
    }
    if (!target || target === document.documentElement || target === document.body) return;
    if (target === selectedEl) return;
    hoveredEl = target;
    positionOverlay(hoverOverlay, target, HOVER_BORDER, HOVER_BG);
    positionLabel(target);
    postToParent('hover', getElementInfo(target));
  }

  function onMouseOut(e) {
    var related = e.relatedTarget;
    if (isInspectorEl(related)) return;
    hoveredEl = null;
    hideOverlay(hoverOverlay);
    hideLabel();
  }

  function onClick(e) {
    if (e.button !== 0) return;
    var real = e.target;
    if (isInspectorEl(real)) return;

    e.preventDefault();
    e.stopPropagation();

    if (real === document.body || real === document.documentElement) {
      deselect();
      return;
    }

    selectElement(real);
  }

  function onDblClick(e) {
    var real = e.target;
    if (isInspectorEl(real)) return;
    if (!canEditText(real)) return;

    e.preventDefault();
    e.stopPropagation();

    startEditing(real);
  }

  function onBlur(e) {
    var real = e.target;
    if (real === editingEl) {
      stopEditing();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (editingEl) {
        e.preventDefault();
        e.stopPropagation();
        stopEditing();
      } else if (selectedEl) {
        e.preventDefault();
        e.stopPropagation();
        deselect();
      }
    }
  }

  function onScroll() {
    if (hoveredEl) updateHoverOverlay();
    if (selectedEl) updateSelectOverlay();
  }

  function onMutation(mutations) {
    var hasRelevant = false;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === 'attributes') {
        var attrName = m.attributeName;
        if (attrName === 'data-skema-inspector') continue;
        if (attrName === 'style' || attrName === 'class' || attrName === 'src' || attrName === 'href' || attrName === 'contenteditable') {
          if (isInspectorEl(m.target)) continue;
          hasRelevant = true;
          break;
        }
      } else if (m.type === 'childList') {
        var added = m.addedNodes;
        var removed = m.removedNodes;
        var dominated = true;
        for (var j = 0; j < added.length; j++) {
          if (!isInspectorEl(added[j])) { dominated = false; break; }
        }
        if (dominated) {
          for (var k = 0; k < removed.length; k++) {
            if (!isInspectorEl(removed[k])) { dominated = false; break; }
          }
        }
        if (!dominated) {
          hasRelevant = true;
          break;
        }
      } else if (m.type === 'characterData') {
        if (!isInspectorEl(m.target.parentNode)) {
          hasRelevant = true;
          break;
        }
      }
    }

    if (hasRelevant) {
      scheduleSync();
    }
  }

  function init() {
    hoverOverlay = createOverlay('hover', HOVER_BORDER, HOVER_BG, Z_HOVER);
    selectOverlay = createOverlay('select', SELECT_BORDER, SELECT_BG, Z_SELECT);
    labelEl = createLabel();

    document.body.appendChild(hoverOverlay);
    document.body.appendChild(selectOverlay);
    document.body.appendChild(labelEl);

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('blur', onBlur, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('message', handleParentMessage, false);

    var observer = new MutationObserver(onMutation);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'src', 'href', 'contenteditable'],
      characterData: true
    });

    postToParent('ready', { html: getCleanHtml() });
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();`;
