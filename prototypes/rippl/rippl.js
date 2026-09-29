/* Rippl' prototype runtime — navigation, overlays, component states and variables */
(function () {
  'use strict';
  if (window.self !== window.top) document.documentElement.classList.add('rp-embed');
  var D = window.RIPPL_DATA;
  var IX = D.ix, VARS = D.vars, SETS = D.sets;
  var root = document.querySelector('.rp');
  var device = root.querySelector('.rp-device');
  var screenBox = root.querySelector('.rp-screen');
  var layer = root.querySelector('.rp-overlays');
  var W = D.size[0], H = D.size[1];

  var assigned = {};      // SET_VARIABLE values
  var globalMode = {};    // SET_VARIABLE_MODE per collection
  var history = [];
  var current = null;
  var overlays = [];      // open overlay records

  function g(o) { return o.sessionID + ':' + o.localID; }
  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); }

  /* ---------- scaling ---------- */
  function fit() {
    var pad = 24;
    var avW = root.clientWidth - pad, avH = root.clientHeight - pad;
    var s = Math.min(1, avW / W, avH / H);
    device.style.transform = 'scale(' + s + ')';
    device.style.marginLeft = device.style.marginRight = (-(W - W * s) / 2) + 'px';
    device.style.marginTop = device.style.marginBottom = (-(H - H * s) / 2) + 'px';
    device.dataset.scale = s;
  }
  function scale() { return parseFloat(device.dataset.scale || '1'); }

  /* ---------- variables ---------- */
  function scopeMode(set, el) {
    for (var e = el; e && e !== root; e = e.parentElement) {
      if (e.dataset && e.dataset.modes) {
        var m = JSON.parse(e.dataset.modes);
        if (m[set]) return m[set];
      }
    }
    return null;
  }
  function resolveVar(id, el) {
    if (Object.prototype.hasOwnProperty.call(assigned, id)) return assigned[id];
    var v = VARS[id];
    if (!v) return undefined;
    var mode = scopeMode(v.set, el) || globalMode[v.set] || (SETS[v.set] || [])[0];
    var raw = v.v[mode];
    if (raw === undefined) { for (var k in v.v) { raw = v.v[k]; break; } }
    return valOf(raw, el);
  }
  function valOf(raw, el) {
    if (raw == null) return undefined;
    if (raw.alias) return raw.alias.guid ? resolveVar(g(raw.alias.guid), el) : undefined;
    if ('textValue' in raw) return raw.textValue;
    if ('boolValue' in raw) return !!raw.boolValue;
    if ('floatValue' in raw) return raw.floatValue;
    if (raw.expressionValue) return expr(raw.expressionValue, el);
    return undefined;
  }
  function expr(x, el) {
    var a = (x.expressionArguments || []).map(function (arg) { return valOf(arg.value, el); });
    switch (x.expressionFunction) {
      case 'EQUALS': return String(a[0]) === String(a[1]);
      case 'NOT_EQUAL': return String(a[0]) !== String(a[1]);
      case 'IS_TRUTHY': return !!a[0] && a[0] !== 'false' && a[0] !== '0';
      case 'NOT': return !a[0];
      case 'AND': return a.every(Boolean);
      case 'OR': return a.some(Boolean);
      case 'LESS_THAN': return a[0] < a[1];
      case 'LESS_THAN_OR_EQUAL': return a[0] <= a[1];
      case 'GREATER_THAN': return a[0] > a[1];
      case 'GREATER_THAN_OR_EQUAL': return a[0] >= a[1];
      case 'ADDITION': return typeof a[0] === 'number' ? a[0] + a[1] : String(a[0]) + String(a[1]);
      case 'SUBTRACTION': return a[0] - a[1];
      case 'MULTIPLY': return a[0] * a[1];
      case 'DIVIDE': return a[0] / a[1];
      case 'RESOLVE_VARIANT': return undefined;
    }
    return undefined;
  }
  function evalData(vd, el) { return vd ? valOf(vd.value, el) : undefined; }

  function refresh(scope) {
    $$('[data-bind]', scope).forEach(function (vg) {
      var bind = JSON.parse(vg.dataset.bind);
      var cur = visibleVariant(vg);
      var want = cur ? JSON.parse(cur.dataset.props) : {};
      var changed = false;
      for (var k in bind) {
        var v = resolveVar(bind[k], vg);
        if (v !== undefined && v !== null) { want[k] = String(v); changed = true; }
      }
      if (!changed) return;
      var match = variants(vg).filter(function (vv) {
        var p = JSON.parse(vv.dataset.props);
        for (var k in want) if (String(p[k]).toLowerCase() !== String(want[k]).toLowerCase()) return false;
        return true;
      })[0];
      if (match && match !== cur) showVariant(vg, match);
    });
    $$('[data-vis]', scope).forEach(function (el) {
      var v = evalData(JSON.parse(el.dataset.vis), el);
      if (v !== undefined) el.hidden = !v;
    });
    $$('[data-text]', scope).forEach(function (el) {
      var v = evalData(JSON.parse(el.dataset.text), el);
      if (v !== undefined) {
        var target = el.querySelector('span') || el;
        target.textContent = String(v);
      }
    });
    $$('[data-op]', scope).forEach(function (el) {
      var v = evalData(JSON.parse(el.dataset.op), el);
      if (typeof v === 'number') el.style.opacity = v > 1 ? v / 100 : v;
    });
  }

  /* ---------- variants ---------- */
  function variants(vg) { return Array.prototype.filter.call(vg.children, function (c) { return c.dataset.sym; }); }
  function visibleVariant(vg) { return variants(vg).filter(function (c) { return !c.hidden; })[0]; }
  /* auto-layout reflow: when a component changes size, move the following
     siblings and grow hugging parents, like Figma's auto layout does */
  function px(el, p) { return parseFloat(el.style[p]) || 0; }
  function items(parent) {
    var out = [];
    Array.prototype.forEach.call(parent.children, function (c) {
      if (c.classList.contains('vg')) Array.prototype.forEach.call(c.children, function (x) { out.push(x); });
      else out.push(c);
    });
    return out;
  }
  function reflow(el, oldPos, oldSize, d, axis) {
    var parent = el.parentElement;
    if (parent && parent.classList.contains('vg')) parent = parent.parentElement;
    if (!parent || !d) return;
    var pos = axis === 'V' ? 'top' : 'left', size = axis === 'V' ? 'height' : 'width';
    if (parent.dataset.al === axis) {
      var edge = oldPos + oldSize - 0.5;
      items(parent).forEach(function (c) {
        if (c === el || c.hasAttribute('data-abs') || (el.parentElement.classList.contains('vg') && c.parentElement === el.parentElement)) return;
        if (px(c, pos) >= edge) c.style[pos] = (px(c, pos) + d) + 'px';
      });
    } else if (!parent.classList.contains('scc')) {
      return;
    }
    if (parent.hasAttribute('data-hug')) {
      var pPos = px(parent, pos), pSize = px(parent, size);
      parent.style[size] = (pSize + d) + 'px';
      if (!parent.classList.contains('scc')) reflow(parent, pPos, pSize, d, axis);
    } else {
      // fixed-size, non-clipping frame: let the surrounding scroll area grow instead
      var sc = parent.closest('.scc');
      if (sc) sc.style[size] = (px(sc, size) + d) + 'px';
    }
  }
  function showVariant(vg, v, anim) {
    var prev = visibleVariant(vg);
    if (prev && prev !== v) {
      var dh = px(v, 'height') - px(prev, 'height'), dw = px(v, 'width') - px(prev, 'width');
      if (Math.abs(dh) > 0.5) reflow(prev, px(prev, 'top'), px(prev, 'height'), dh, 'V');
      if (Math.abs(dw) > 0.5) reflow(prev, px(prev, 'left'), px(prev, 'width'), dw, 'H');
    }
    variants(vg).forEach(function (c) { c.hidden = c !== v; });
    if (anim) { v.classList.remove('rp-fade'); void v.offsetWidth; v.classList.add('rp-fade'); }
    refresh(v);
  }
  function swapState(el, target) {
    for (var e = el; e && e !== root; e = e.parentElement) {
      if (e.classList && e.classList.contains('vg')) {
        var v = variants(e).filter(function (c) { return c.dataset.sym === target; })[0];
        if (v) { var prev = visibleVariant(e); showVariant(e, v, true); return { vg: e, prev: prev }; }
      }
    }
    return null;
  }

  /* ---------- screens & overlays ---------- */
  function frameEl(id) { return $('.rp-frame[data-id="' + id + '"]'); }
  function animate(el, type, dir) {
    var cls = { MOVE_FROM_BOTTOM: 'rp-in-up', SLIDE_FROM_BOTTOM: 'rp-in-up', MOVE_FROM_RIGHT: 'rp-in-left', SLIDE_FROM_RIGHT: 'rp-in-left', PUSH_FROM_RIGHT: 'rp-in-left',
      MOVE_FROM_LEFT: 'rp-in-right', SLIDE_FROM_LEFT: 'rp-in-right', PUSH_FROM_LEFT: 'rp-in-right', MOVE_FROM_TOP: 'rp-in-down', SLIDE_FROM_TOP: 'rp-in-down',
      DISSOLVE: 'rp-fade', SMART_ANIMATE: 'rp-fade' }[type];
    if (!cls) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 450);
  }
  function resetScroll(el) { $$('.sc', el).forEach(function (s) { s.scrollTop = 0; s.scrollLeft = 0; }); }
  function go(id, a, push) {
    var f = frameEl(id);
    if (!f || id === current) return;
    closeAll();
    if (current && push !== false) history.push(current);
    $$('.rp-screen > .rp-frame').forEach(function (s) { s.hidden = s !== f; });
    screenBox.appendChild(f);
    f.hidden = false;
    current = id;
    if (!a || a.transitionResetScrollPosition !== 0) resetScroll(f);
    animate(f, a && a.transitionType);
    refresh(f);
    updateNav();
  }
  function back() {
    if (overlays.length) return closeTop();
    var prev = history.pop();
    if (prev) go(prev, null, false);
  }
  function openOverlay(id, a, trigger, replace) {
    var f = frameEl(id);
    if (!f) return;
    if (replace && overlays.length) closeTop(true);
    var o = JSON.parse(f.dataset.overlay || '{}');
    var wrap = document.createElement('div');
    wrap.className = 'rp-ov';
    if (o.bg) wrap.style.background = o.bg;
    var fw = parseFloat(f.style.width), fh = parseFloat(f.style.height);
    var x = (W - fw) / 2, y = (H - fh) / 2;
    var pos = o.pos || 'CENTER';
    if (a && a.overlayRelativePosition && trigger) {
      var r = trigger.getBoundingClientRect(), sr = device.getBoundingClientRect(), s = scale();
      x = (r.left - sr.left) / s + a.overlayRelativePosition.x;
      y = (r.top - sr.top) / s + a.overlayRelativePosition.y;
    } else if (pos.indexOf('TOP') === 0) y = 0;
    else if (pos.indexOf('BOTTOM') === 0) y = H - fh;
    if (/_LEFT$/.test(pos)) x = 0; else if (/_RIGHT$/.test(pos)) x = W - fw;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    f.hidden = false;
    wrap.appendChild(f);
    layer.appendChild(wrap);
    var rec = { id: id, wrap: wrap, frame: f, closeOutside: o.close !== false };
    overlays.push(rec);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap && rec.closeOutside) { e.stopPropagation(); closeOverlay(rec); }
    });
    animate(f, a && a.transitionType);
    resetScroll(f);
    refresh(f);
  }
  function closeOverlay(rec) {
    var i = overlays.indexOf(rec);
    if (i < 0) return;
    overlays.splice(i, 1);
    rec.frame.hidden = true;
    $('.rp-store').appendChild(rec.frame);
    rec.wrap.remove();
  }
  function closeTop() { if (overlays.length) closeOverlay(overlays[overlays.length - 1]); }
  function closeAll() { while (overlays.length) closeTop(); }
  function closeFor(el) {
    var rec = overlays.filter(function (r) { return r.wrap.contains(el); })[0];
    closeOverlay(rec || overlays[overlays.length - 1]);
  }

  /* ---------- actions ---------- */
  function run(actions, el, hoverRec) {
    (actions || []).forEach(function (a) { act(a, el, hoverRec); });
    refresh();
  }
  function act(a, el, hoverRec) {
    var t = a.transitionNodeID ? g(a.transitionNodeID) : null;
    if (t === '4294967295:4294967295') t = null;
    switch (a.connectionType) {
      case 'INTERNAL_NODE':
        if (!t) return;
        switch (a.navigationType) {
          case 'OVERLAY': return openOverlay(t, a, el);
          case 'SWAP': return openOverlay(t, a, el, true);
          case 'SWAP_STATE': var r = swapState(el, t); if (r && hoverRec) hoverRec.push(r); return;
          case 'SCROLL_TO': var tgt = $('[data-guid="' + t + '"]'); if (tgt) tgt.scrollIntoView({ behavior: 'smooth' }); return;
          default: return go(t, a);
        }
      case 'BACK': return back();
      case 'CLOSE': return closeFor(el);
      case 'URL': if (a.connectionURL) window.open(a.connectionURL, '_blank', 'noopener'); return;
      case 'SET_VARIABLE':
        if (a.targetVariable && a.targetVariable.id && a.targetVariable.id.guid)
          assigned[g(a.targetVariable.id.guid)] = evalData(a.targetVariableData, el);
        return;
      case 'SET_VARIABLE_MODE':
        if (a.targetVariableSetID && a.targetVariableSetID.guid && a.targetVariableModeID) {
          var set = g(a.targetVariableSetID.guid);
          globalMode[set] = g(a.targetVariableModeID);
          for (var id in assigned) if (VARS[id] && VARS[id].set === set) delete assigned[id];
        }
        return;
      case 'CONDITIONAL':
        var cs = a.conditionalActions || [];
        for (var i = 0; i < cs.length; i++) {
          var c = cs[i];
          if (!c.condition || evalData(c.condition, el)) { (c.actions || []).forEach(function (b) { act(b, el, hoverRec); }); break; }
        }
        return;
    }
  }
  function interactions(el) { return IX[+el.dataset.ix] || []; }
  function handle(el, type) {
    var done = false;
    interactions(el).forEach(function (x) {
      var ev = (x.event && x.event.interactionType) || 'ON_CLICK';
      if (ev === type) { run(x.actions, el); done = true; }
    });
    return done;
  }

  root.addEventListener('click', function (e) {
    for (var el = e.target; el && el !== root; el = el.parentElement) {
      if (el.dataset && el.dataset.ix !== undefined && !el.closest('[hidden]')) {
        if (handle(el, 'ON_CLICK') || handle(el, 'ON_PRESS') || handle(el, 'DRAG')) { e.stopPropagation(); return; }
      }
      if (el.classList && el.classList.contains('rp-ov')) return;
    }
  });
  function wireHover(scope) {
    $$('[data-ix]', scope).forEach(function (el) {
      if (el._rpHover) return;
      var xs = interactions(el);
      xs.forEach(function (x) {
        var ev = x.event && x.event.interactionType;
        if (ev === 'ON_HOVER') {
          el._rpHover = true;
          var rec = [];
          el.addEventListener('mouseenter', function () { rec = []; run(x.actions, el, rec); });
          el.addEventListener('mouseleave', function () { rec.forEach(function (r) { if (r.prev) showVariant(r.vg, r.prev); }); rec = []; });
        } else if (ev === 'MOUSE_ENTER' || ev === 'MOUSE_LEAVE') {
          el._rpHover = true;
          el.addEventListener(ev === 'MOUSE_ENTER' ? 'mouseenter' : 'mouseleave', function () {
            var vg = el.closest('.vg');
            run(x.actions, el);
            if (vg) wireHover(vg);
          });
        }
      });
    });
  }

  /* ---------- tab bar highlight ---------- */
  function updateNav() {
    var tabs = $('.rp-tabs');
    if (!tabs) return;
    $$('button', tabs).forEach(function (b) { b.setAttribute('aria-current', b.dataset.go === current ? 'page' : 'false'); });
  }

  /* ---------- keyboard: Escape closes overlays / goes back ---------- */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') back(); });

  window.addEventListener('resize', fit);
  fit();
  wireHover(root);
  $$('.rp-frame').forEach(function (f) { if (f.dataset.id !== D.start) f.hidden = true; });
  refresh();
  go(D.start, null, false);
  window.Rippl = { go: go, back: back, open: openOverlay };
})();
