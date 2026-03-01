/**
 * Shared navigation JavaScript injected into all templates.
 * Handles keyboard navigation, click-to-advance, hotspot links, and theme toggle.
 */

import type { DesignCanvas } from "../../types/design.js";
import type { NibConfig } from "../../types/config.js";

export function navigationScript(canvases: DesignCanvas[], config?: NibConfig): string {
  const links = config?.links ?? [];
  const linksJson = JSON.stringify(links);

  return `<script>
(function() {
  var canvases = document.querySelectorAll('.nib-canvas');
  var total = canvases.length;
  var current = 0;
  var links = ${linksJson};

  function show(idx) {
    canvases.forEach(function(c, i) { c.classList.toggle('active', i === idx); });
    current = idx;
    var counter = document.getElementById('nib-counter');
    if (counter) counter.textContent = (idx + 1) + ' / ' + total;
    var progress = document.getElementById('nib-progress');
    if (progress) progress.style.width = ((idx + 1) / total * 100) + '%';
  }

  function next() { if (current < total - 1) show(current + 1); }
  function prev() { if (current > 0) show(current - 1); }

  // Keyboard: arrows, space, F for fullscreen
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });

  // Click to advance + hotspot link detection
  document.addEventListener('click', function(e) {
    if (e.target.closest('.nib-controls, #nib-theme-toggle')) return;
    var nodeEl = e.target.closest('[data-node-name]');
    if (nodeEl && links.length) {
      var currentName = canvases[current] && canvases[current].dataset.name;
      var link = links.find(function(l) {
        return l.from === currentName && l.nodeId === nodeEl.id.replace('n-', '');
      });
      if (link) {
        var targetIdx = Array.from(canvases).findIndex(function(c) {
          return c.dataset.name === link.to;
        });
        if (targetIdx >= 0) { show(targetIdx); return; }
      }
    }
    next();
  });

  // Presentation controls (prev/next/fullscreen buttons)
  var prevBtn = document.getElementById('nib-prev');
  var nextBtn = document.getElementById('nib-next');
  var fsBtn = document.getElementById('nib-fullscreen');
  if (prevBtn) prevBtn.addEventListener('click', function(e) { e.stopPropagation(); prev(); });
  if (nextBtn) nextBtn.addEventListener('click', function(e) { e.stopPropagation(); next(); });
  if (fsBtn) fsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });

  // Theme toggle
  var themeBtn = document.getElementById('nib-theme-toggle');
  if (themeBtn) {
    var dark = false;
    themeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      dark = !dark;
      document.documentElement.classList.toggle('theme-dark', dark);
      document.documentElement.classList.toggle('theme-light', !dark);
    });
  }

  show(0);
})();
</script>`;
}

export function themeToggleHtml(): string {
  return `<button id="nib-theme-toggle" style="position:fixed;top:12px;right:12px;z-index:200;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;">Toggle theme</button>`;
}
