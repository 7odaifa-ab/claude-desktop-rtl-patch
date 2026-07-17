;(function() {
    'use strict';
    if (typeof document === 'undefined') return;
    // Once-per-window guard. The patch prepends this payload to EVERY renderer
    // chunk, and a window lazy-loads many chunks -- without the guard each
    // loaded chunk would register its own MutationObserver and input listener,
    // multiplying the work done on every DOM mutation. First copy wins.
    if (window.__claudeRtlInit) return;
    window.__claudeRtlInit = true;
    try {
        var WRITING_SEL = '[data-testid="chat-input"]';

        // Never mutate DOM that a live editor owns (issue #33). ProseMirror
        // reverts foreign mutations inside its subtree, which re-fires our
        // MutationObserver, which mutates again -- an infinite loop that hangs
        // the app. WRITING_SEL alone is brittle: the testid is served by
        // claude.ai and can change at any moment, so skip-guards detect the
        // editor by its fundamental nature instead. Deliberately NOT a bare
        // [contenteditable]: that would also match contenteditable="false"
        // widgets and strip RTL from rendered content.
        var EDITOR_SEL = WRITING_SEL + ', [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], .ProseMirror, [role="textbox"]';

        // --- NATIVE RTL INTEROP (claude.ai "alluvium" renderer, 2026) ---
        //
        // claude.ai now stamps dir="rtl|ltr" on markdown blocks natively (Code
        // tab today; a chat renderer with the same logic sits disabled in the
        // bundle). Their detector is first-strong over the first 80 chars,
        // INCLUDING inline code/URLs; lists are judged by their first item
        // only, tables by their first header cell only. Cells, list items,
        // user messages, inputs and UI chrome get no native dir at all.
        //
        // Ownership rule: every dir the patch sets carries MANAGED_FLAG. A dir
        // WITHOUT the flag is native -- it is NEVER removed or reset (React
        // re-stamps it on each streaming re-render; fighting it garbles the
        // page). The patch overrides a native dir only via the code-aware
        // confident layers, and freely fills every gap native leaves.
        var MANAGED_FLAG = 'data-rtl-managed';
        var NATIVE_DIR_SEL = '[dir]:not([' + MANAGED_FLAG + '])';
        // Streaming markdown host: frontier blocks re-render continuously
        // while streaming, so structural work (math islands) waits for quiet.
        var STREAM_HOST_SEL = '[data-alluvium]';

        function isNativeDir(el) {
            return el.hasAttribute('dir') && !el.hasAttribute(MANAGED_FLAG);
        }

        // True when el sits under a native-dir'd ancestor (or is one itself).
        // <html>/<body> are excluded: on a Hebrew-locale OS claude.ai stamps
        // dir="rtl" on the ROOT element -- a page-wide default, not a per-block
        // decision -- and treating it as native ownership would turn every
        // guard into a global no-op.
        function inNativeDirSubtree(el) {
            var host = el.closest ? el.closest(NATIVE_DIR_SEL) : null;
            return !!(host && host !== document.documentElement && host !== document.body);
        }

        function stampDir(el, dir) {
            el.setAttribute(MANAGED_FLAG, '1');
            el.dir = dir;
            el.style.direction = dir;
        }

        function unstampDir(el) {
            if (el.hasAttribute('dir')) el.removeAttribute('dir');
            el.removeAttribute(MANAGED_FLAG);
            el.style.direction = '';
        }

        // --- PURE DETECTION CORE (inlined from src/rtl-core.js by build-payload.ps1) ---
        /*__RTL_CORE__*/
        // --- END PURE DETECTION CORE ---

        // Get text from element excluding <code> children (DOM-aware)
        function textWithoutCode(el) {
            var out = '';
            var nodes = el.childNodes;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n.nodeType === 3) { out += n.textContent; }
                else if (n.nodeType === 1 && n.tagName !== 'CODE' && n.tagName !== 'PRE') {
                    out += textWithoutCode(n);
                }
            }
            return out;
        }

        // --- PER-LINE DIRECTIONAL SPLITTING ---
        //
        // A paragraph rendered with <br> separators or whitespace-pre may carry
        // multiple lines, each in a different script. Forcing a single dir on the
        // host element mangles every line that disagrees. We instead defer to
        // unicode-bidi:plaintext and stamp data-rtl-split so later passes skip it.

        var RTL_SPLIT_FLAG = 'data-rtl-split';
        var BR_OR_NL_SPLIT = /(<br\s*\/?>|\n)/i;

        function hasMultiScriptLines(el) {
            var src = el.textContent;
            if (!src) return false;
            if (!/[a-zA-Z]{2,}/.test(src)) return false;
            if (!hasRTL(src)) return false;
            return BR_OR_NL_SPLIT.test(el.innerHTML) || src.indexOf('\n') !== -1;
        }

        function splitToDirectionalSpans(el) {
            if (el.hasAttribute(RTL_SPLIT_FLAG)) return;
            // No DOM rewriting -- assigning el.innerHTML broke React reconciliation
            // ("Failed to execute 'removeChild' on 'Node'"). Defer to
            // unicode-bidi:plaintext: <br> is a paragraph separator in the Unicode
            // BiDi algorithm, so each line auto-picks its direction from first-strong.
            el.setAttribute(RTL_SPLIT_FLAG, '1');
            // Only a patch-owned dir may be removed. A NATIVE dir stays put
            // (ownership rule); unicode-bidi:plaintext neutralizes it anyway,
            // because plaintext resolves each line from its own first-strong
            // character regardless of the element's dir attribute.
            if (!isNativeDir(el)) unstampDir(el);
            el.style.direction = '';
            el.style.textAlign = 'start';
            el.style.unicodeBidi = 'plaintext';
        }

        // If the element inherits RTL via a parent CSS class (not an explicit dir
        // attribute on itself), removing dir alone won't free it -- pin direction=ltr.
        // NEVER touches a native dir: deleting one re-ignites the React re-stamp
        // fight that garbled the Code tab (the original merge conflict).
        function resetDirOrPinLTR(el) {
            if (isNativeDir(el)) return;
            if (window.getComputedStyle(el).direction === 'rtl') {
                stampDir(el, 'ltr');
                return;
            }
            unstampDir(el);
        }

        // --- HYBRID DIRECTION DETECTION ---

        // For DOM elements (output): 3-layer detection
        function detectElDir(el) {
            var full = el.textContent || '';
            if (!hasRTL(full)) return null;

            // Layer 1: first-strong on text excluding <code> children
            var noCode = textWithoutCode(el);
            var d = firstStrong(noCode);
            if (d === 'rtl') return 'rtl';

            // Layer 2: strip leading filenames/URLs, then first-strong
            var stripped = stripLeadingLTR(noCode);
            d = firstStrong(stripped);
            if (d === 'rtl') return 'rtl';

            // Layer 3: RTL chars exist but first-strong still says LTR even
            // after stripping -- majority script decides. An English paragraph
            // quoting a single Hebrew word stays LTR; a Hebrew-dominant block
            // whose Latin prefix survived the strip still flips RTL.
            return rtlMajority(noCode) ? 'rtl' : null;
        }

        // Majority first-strong over a list's items: confident enough to
        // overrule a native list dir, which is judged by the FIRST item only.
        function listConfidentDir(el) {
            var dirs = [];
            for (var i = 0; i < el.children.length; i++) {
                var li = el.children[i];
                if (li.tagName !== 'LI') continue;
                var t = textWithoutCode(li);
                var d = firstStrong(t);
                if (d !== 'rtl') d = firstStrong(stripLeadingLTR(t)) || d;
                dirs.push(d || null);
            }
            return majorityDir(dirs);
        }

        // For plain text (input box, dialogs without DOM structure)
        function detectTextDir(text) {
            if (!text || !text.trim()) return null;
            var d = firstStrong(text);
            if (d === 'rtl') return 'rtl';
            if (!hasRTL(text)) return 'ltr';

            var stripped = stripLeadingLTR(text);
            d = firstStrong(stripped);
            if (d === 'rtl') return 'rtl';

            return rtlMajority(text) ? 'rtl' : 'ltr';
        }

        // --- ELEMENT PROCESSING ---

        // querySelectorAll that INCLUDES root itself if it matches
        function qsa(root, sel) {
            var base = root.querySelectorAll ? root : document;
            var els = Array.from(base.querySelectorAll(sel));
            if (root.matches && root.matches(sel)) els.unshift(root);
            return els;
        }

        function forceCodeLTR(root) {
            // Inside editors the injected stylesheet already pins pre/code/katex
            // LTR; stamping here would fight ProseMirror (issue #33).
            qsa(root, 'pre, .code-block__code, .relative.group\\/copy').forEach(function(b) {
                if (b.closest(EDITOR_SEL)) return;
                stampDir(b, 'ltr'); b.style.textAlign = 'left'; b.style.unicodeBidi = 'embed';
            });
            qsa(root, 'code').forEach(function(c) {
                if (c.closest(EDITOR_SEL)) return;
                if (!c.closest('pre') && !c.closest('.code-block__code')) stampDir(c, 'ltr');
            });
            // Rendered math (KaTeX/MathJax), if present, is an LTR island too.
            qsa(root, '.katex, .katex-display, mjx-container').forEach(function(m) {
                if (m.closest(EDITOR_SEL)) return;
                m.style.unicodeBidi = 'isolate'; m.style.direction = 'ltr';
            });
        }

        // --- RAW LaTeX + BARE-ARITHMETIC ISOLATION ---
        //
        // Claude Desktop (Windows) does not render LaTeX -- it shows raw "$...$" text.
        // Inside an RTL paragraph the neutral $ \ { } chars scramble the formula, and
        // bare arithmetic ("2 + 3 = 5", "5-3", "x = 10") gets mirrored to "5 = 3 + 2"
        // by the bidi algorithm. We isolate each math segment (LaTeX or bare numeric,
        // per segmentText) in its own ltr/unicode-bidi:isolate span. We replace a
        // single TEXT node with a fragment (replaceChild) -- never innerHTML -- to stay
        // gentle on React reconciliation, and flag islands so we never re-wrap during
        // streaming.
        var ISLAND_FLAG = 'data-rtl-island';

        // While a streaming markdown host is actively mutating, its frontier
        // blocks are re-rendered wholesale -- any replaceChild we do there is
        // clobbered and redone every tick (visible churn). Islands inside a
        // stream host wait for a quiet window; the observer schedules a settle
        // pass that catches up once streaming pauses/ends.
        var lastStreamMut = 0;
        var STREAM_QUIET_MS = 500;

        function inActiveStream(el) {
            if (!el.closest || !el.closest(STREAM_HOST_SEL)) return false;
            return (Date.now() - lastStreamMut) < STREAM_QUIET_MS;
        }

        function isolateMath(root) {
            if (typeof document.createTreeWalker !== 'function') return;
            var host = (root && root.nodeType === 1) ? root : document.body;
            if (!host) return;
            var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
                acceptNode: function(node) {
                    var v = node.nodeValue;
                    if (!v) return NodeFilter.FILTER_REJECT;
                    // Cheap pre-filter: a LaTeX hint ($ or \), OR a numeric hint
                    // (a digit AND an operator). MATH_DIGIT_RE / MATH_OP_RE come from
                    // the inlined core above and are stateless (no /g flag).
                    var hasTex = v.indexOf('$') !== -1 || v.indexOf('\\') !== -1;
                    var hasNum = MATH_DIGIT_RE.test(v) && MATH_OP_RE.test(v);
                    if (!hasTex && !hasNum) return NodeFilter.FILTER_REJECT;
                    var p = node.parentElement;
                    if (!p) return NodeFilter.FILTER_REJECT;
                    if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
                    // EDITOR_SEL, not WRITING_SEL: replaceChild on a text node
                    // the user is typing into is the most violent mutation an
                    // editor can receive -- "-" then a digit passes the numeric
                    // pre-filter above and ignited the issue #33 freeze loop.
                    if (p.closest('pre, code, .code-block__code, [' + ISLAND_FLAG + '], ' + EDITOR_SEL)) return NodeFilter.FILTER_REJECT;
                    // Streaming frontier: defer to the settle pass.
                    if (inActiveStream(p)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            // Collect first -- mutating during the walk invalidates the walker.
            var targets = [];
            var n;
            while ((n = walker.nextNode())) targets.push(n);
            targets.forEach(function(textNode) {
                var segs = segmentText(textNode.nodeValue);
                var hasMath = segs.some(function(s) { return s.type === 'math'; });
                if (!hasMath) return;
                var frag = document.createDocumentFragment();
                segs.forEach(function(s) {
                    if (s.type === 'math') {
                        var span = document.createElement('span');
                        span.setAttribute(ISLAND_FLAG, '1');
                        span.style.unicodeBidi = 'isolate';
                        span.style.direction = 'ltr';
                        span.textContent = s.value;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(s.value));
                    }
                });
                if (textNode.parentNode) textNode.parentNode.replaceChild(frag, textNode);
            });
        }

        // --- TABLE COLUMN ORDERING ---
        //
        // A Hebrew table should read right-to-left: the first column on the right.
        // Per-cell direction is handled by processText; here we only flip the whole
        // table's column order via dir="rtl" on a stable <table> element (no text
        // surgery, low risk). Only flip once we are confident it is a Hebrew table;
        // leave the flag off otherwise so a table still streaming can re-evaluate.
        var TABLE_FLAG = 'data-rtl-table';

        function processTables(root) {
            qsa(root, 'table').forEach(function(t) {
                if (t.getAttribute(TABLE_FLAG) === 'rtl') return;
                if (t.closest(EDITOR_SEL)) return;
                // Native flip: claude.ai stamps dir on the table's WRAPPER div
                // (judged by the first header cell only). If the columns are
                // already flowing RTL under a native dir, adopt it -- the flip
                // happened, only per-cell work (processText) remains.
                if (inNativeDirSubtree(t) && getComputedStyle(t).direction === 'rtl') {
                    t.setAttribute(TABLE_FLAG, 'rtl');
                    return;
                }
                var headerCells = Array.from(t.querySelectorAll('thead th'));
                if (!headerCells.length) {
                    var firstRow = t.querySelector('tr');
                    if (firstRow) headerCells = Array.from(firstRow.querySelectorAll('th, td'));
                }
                var headerDirs = headerCells.map(function(c) { return cellDir(c.textContent || ''); });
                var rows = Array.from(t.querySelectorAll('tbody tr'));
                if (!rows.length) rows = Array.from(t.querySelectorAll('tr')).slice(1);
                var firstColDirs = rows.map(function(r) {
                    var cell = r.querySelector('th, td');
                    return cell ? cellDir(cell.textContent || '') : null;
                });
                if (tableDirFromCells(headerDirs, firstColDirs) === 'rtl') {
                    // Native missed this one (e.g. Latin-first header cell on a
                    // Hebrew table). Flip the <table> itself -- stamped, never
                    // the native wrapper.
                    t.setAttribute(TABLE_FLAG, 'rtl');
                    stampDir(t, 'rtl');
                }
            });
        }

        function processText(root) {
            // Standard text elements
            qsa(root, 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, summary, label, dt, dd').forEach(function(el) {
                if (el.closest(EDITOR_SEL) || el.closest('pre') || el.closest('.code-block__code')) return;
                if (el.hasAttribute(RTL_SPLIT_FLAG)) return;
                if (isNativeDir(el)) {
                    // Native already directed this block. Add only what native
                    // cannot express; never remove or downgrade its dir.
                    //
                    // Multi-script lines first, for EITHER native dir: native
                    // gives the whole block one dir from its first 80 chars,
                    // so a Hebrew quote whose first line is a Latin marker
                    // ("[!IMPORTANT]<br>...") gets ltr and every Hebrew line
                    // below renders backwards. plaintext resolves each line
                    // independently and leaves the native dir attribute alone.
                    if (hasRTL(el.textContent || '') && hasMultiScriptLines(el)) {
                        splitToDirectionalSpans(el);
                    } else if (el.getAttribute('dir') !== 'rtl' &&
                               detectElDir(el) === 'rtl') {
                        // Disagreement (code-prefixed or Latin-first Hebrew):
                        // override. Safe now that layer 3 requires an RTL
                        // majority rather than a single RTL character.
                        stampDir(el, 'rtl');
                    }
                    if (el.getAttribute('dir') === 'rtl' && el.tagName === 'LI') {
                        el.style.listStylePosition = 'inside';
                    }
                    return;
                }
                var dir = detectElDir(el);
                if (dir) {
                    if (dir === 'rtl' && hasMultiScriptLines(el)) {
                        splitToDirectionalSpans(el);
                        return;
                    }
                    stampDir(el, dir);
                    if (el.tagName === 'LI') {
                        el.style.listStylePosition = (dir === 'rtl') ? 'inside' : '';
                        var parentList = el.closest('ul, ol');
                        if (parentList && dir === 'rtl' && !parentList.hasAttribute('dir')) {
                            stampDir(parentList, 'rtl');
                            var pl = getComputedStyle(parentList).paddingLeft;
                            if (parseFloat(pl) > 0) { parentList.style.paddingRight = pl; parentList.style.paddingLeft = '0'; }
                        }
                    }
                } else {
                    resetDirOrPinLTR(el);
                    if (el.tagName === 'LI') el.style.listStylePosition = '';
                }
            });

            // Lists
            qsa(root, 'ul, ol').forEach(function(el) {
                if (el.closest(EDITOR_SEL) || el.closest('pre')) return;
                if (isNativeDir(el)) {
                    // Native judges a list by its FIRST item only. Overrule
                    // its ltr only on a confident majority of item dirs.
                    if (el.getAttribute('dir') !== 'rtl' &&
                            listConfidentDir(el) === 'rtl') {
                        stampDir(el, 'rtl');
                        var npl = getComputedStyle(el).paddingLeft;
                        if (parseFloat(npl) > 0) { el.style.paddingRight = npl; el.style.paddingLeft = '0'; }
                    }
                    return;
                }
                var dir = detectElDir(el);
                if (dir === 'rtl') {
                    stampDir(el, 'rtl');
                    var pl = getComputedStyle(el).paddingLeft;
                    if (parseFloat(pl) > 0) { el.style.paddingRight = pl; el.style.paddingLeft = '0'; }
                } else {
                    resetDirOrPinLTR(el);
                    el.style.paddingRight = ''; el.style.paddingLeft = '';
                }
            });
        }

        // Universal: process ANY leaf text container (catches dialogs, tooltips, etc.)
        function processContainers(root) {
            qsa(root, 'div, span, button, a, label').forEach(function(el) {
                if (el.closest('pre') || el.closest('code') || el.closest(EDITOR_SEL)) return;
                // A subtree under NATIVE direction control is native's problem
                // space: its inline spans are React-owned and the block-level
                // dir already resolves them. Poking spans there re-fights the
                // renderer for zero visual gain.
                if (inNativeDirSubtree(el)) return;
                if (el.hasAttribute(RTL_SPLIT_FLAG)) return;
                if (el.hasAttribute(ISLAND_FLAG)) return;
                var parent = el.parentElement;
                if (parent && parent.hasAttribute(RTL_SPLIT_FLAG)) return;
                if (el.querySelector('p, div, ul, ol, h1, h2, h3, h4, h5, h6, pre, table')) return;
                if (/^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|UL|OL)$/.test(el.tagName)) return;
                var text = (el.textContent || '').trim();
                if (text.length < 2) return;
                if (hasRTL(text)) {
                    if (hasMultiScriptLines(el)) {
                        splitToDirectionalSpans(el);
                    } else {
                        stampDir(el, detectTextDir(text) || 'rtl');
                        el.style.textAlign = 'start';
                    }
                } else if (el.hasAttribute('dir')) {
                    unstampDir(el);
                    el.style.textAlign = '';
                }
            });
        }

        function processInput() {
            document.querySelectorAll(WRITING_SEL).forEach(function(input) {
                var text = input.textContent || input.innerText || '';
                var dir = detectTextDir(text);
                if (dir === 'rtl') {
                    input.style.direction = 'rtl'; input.style.textAlign = 'right'; input.style.paddingRight = '25px';
                } else {
                    input.style.direction = 'ltr'; input.style.textAlign = 'left'; input.style.paddingRight = '';
                }
            });
        }

        function processAll() {
            isolateMath(document.body);
            processText(document);
            processContainers(document.body);
            processTables(document.body);
            processInput();
            forceCodeLTR(document.body);
        }

        function injectStyles() {
            if (document.getElementById('claude-rtl-styles')) return;
            var s = document.createElement('style');
            s.id = 'claude-rtl-styles';
            s.textContent = [
                'p:not([dir]),li:not([dir]),h1:not([dir]),h2:not([dir]),h3:not([dir]),h4:not([dir]),h5:not([dir]),h6:not([dir]),blockquote:not([dir]),td:not([dir]),th:not([dir]),summary:not([dir]),label:not([dir]),legend:not([dir]),dt:not([dir]),dd:not([dir]),figcaption:not([dir]),caption:not([dir]){unicode-bidi:plaintext!important;text-align:start!important}',
                'pre,.code-block__code,.relative.group\\/copy{unicode-bidi:embed!important;direction:ltr!important;text-align:left!important}',
                'code{unicode-bidi:isolate!important;direction:ltr!important}',
                // Raw LaTeX islands and rendered math are isolated LTR units.
                '[data-rtl-island]{unicode-bidi:isolate!important;direction:ltr!important}',
                '.katex,.katex-display,mjx-container{unicode-bidi:isolate!important;direction:ltr!important}',
                // Hebrew tables: flip column order; cells keep their own direction.
                'table[dir="rtl"]{direction:rtl!important}',
                // Scoped to patch-owned dirs: native-dir'd blocks (claude.ai
                // "alluvium") have their own layout children (word-fade spans)
                // that a blanket plaintext rule disturbs.
                '[data-rtl-managed][dir]{text-align:start!important}[data-rtl-managed][dir="rtl"]{direction:rtl!important}[data-rtl-managed][dir="ltr"]{direction:ltr!important}',
                '[data-rtl-managed][dir]>*:not([dir]):not(pre):not(code):not(.code-block__code){unicode-bidi:plaintext;text-align:start}',
                // RTL: flip sidebar truncation gradient to fade the LEFT edge (issue #7).
                '[dir="rtl"][class*="mask-image:linear-gradient(to_right"]{-webkit-mask-image:linear-gradient(to left,hsl(var(--always-black)) 85%,transparent 99%)!important;mask-image:linear-gradient(to left,hsl(var(--always-black)) 85%,transparent 99%)!important}',
                '.group:hover [dir="rtl"][class*="mask-image:linear-gradient(to_right"],.group:focus-within [dir="rtl"][class*="mask-image:linear-gradient(to_right"],[data-menu-open="true"] [dir="rtl"][class*="mask-image:linear-gradient(to_right"]{-webkit-mask-image:linear-gradient(to left,hsl(var(--always-black)) 60%,transparent 78%)!important;mask-image:linear-gradient(to left,hsl(var(--always-black)) 60%,transparent 78%)!important}'
            ].join('');
            document.head.appendChild(s);
        }

        function init() {
            injectStyles();
            processAll();

            // Input box live direction switching
            document.addEventListener('input', function(e) {
                var t = e.target;
                if (!t || !(t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
                var text = t.textContent || t.innerText || t.value || '';
                var dir = detectTextDir(text);
                if (dir === 'rtl') {
                    t.style.direction = 'rtl'; t.style.textAlign = 'right'; t.style.paddingRight = '25px';
                } else {
                    t.style.direction = 'ltr'; t.style.textAlign = 'left'; t.style.paddingRight = '';
                }
            }, true);

            // Watch DOM changes (throttle, not debounce -- process DURING streaming)
            var pendingMuts = [];

            // Structural loop-breaker (issue #33), independent of the per-element
            // skip-guards: a freeze loop needs "editor mutation -> schedule ->
            // write into editor -> editor mutation". Dropping editor-internal
            // records at intake cuts that chain at its first link, so even a
            // future missed guard degrades to a one-shot fight instead of a
            // hang. Also skips rescheduling work on every keystroke burst.
            function mutInsideEditor(m) {
                var t = m.target;
                var el = (t && t.nodeType === 1) ? t : (t ? t.parentElement : null);
                return !!(el && el.closest && el.closest(EDITOR_SEL));
            }

            function mutInsideStream(m) {
                var t = m.target;
                var el = (t && t.nodeType === 1) ? t : (t ? t.parentElement : null);
                return !!(el && el.closest && el.closest(STREAM_HOST_SEL));
            }

            // One-shot settle pass: after a stream host goes quiet, run the
            // deferred math isolation over it (islands skipped mid-stream).
            var settleTimer = null;
            function scheduleStreamSettle() {
                lastStreamMut = Date.now();
                if (settleTimer) clearTimeout(settleTimer);
                settleTimer = setTimeout(function() {
                    settleTimer = null;
                    document.querySelectorAll(STREAM_HOST_SEL).forEach(function(h) {
                        isolateMath(h);
                    });
                }, STREAM_QUIET_MS + 100);
            }

            var obs = new MutationObserver(function(muts) {
                var relevant = [];
                var touchedStream = false;
                for (var i = 0; i < muts.length; i++) {
                    var m = muts[i];
                    if (m.addedNodes.length === 0 && m.type !== 'characterData') continue;
                    if (mutInsideEditor(m)) continue;
                    if (!touchedStream && mutInsideStream(m)) touchedStream = true;
                    relevant.push(m);
                }
                if (touchedStream) scheduleStreamSettle();
                if (!relevant.length) return;
                for (var j = 0; j < relevant.length; j++) pendingMuts.push(relevant[j]);
                if (window._rtlT) return; // throttle: already scheduled
                window._rtlT = setTimeout(function() {
                    window._rtlT = null;
                    var toProcess = pendingMuts;
                    pendingMuts = [];
                    var roots = new Set();
                    toProcess.forEach(function(m) {
                        m.addedNodes.forEach(function(n) { if (n.nodeType === 1) roots.add(n); });
                        if (m.type === 'characterData' && m.target.parentElement) roots.add(m.target.parentElement);
                    });
                    var expanded = new Set(roots);
                    roots.forEach(function(r) {
                        if (!r.closest) return;
                        var txt = r.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, summary, label, dt, dd');
                        if (txt) expanded.add(txt);
                        var list = r.closest('ul, ol');
                        if (list) expanded.add(list);
                        var tbl = r.closest('table');
                        if (tbl) expanded.add(tbl);
                    });
                    roots = expanded;
                    if (roots.size > 0 && roots.size <= 30) {
                        roots.forEach(function(r) {
                            isolateMath(r);
                            processText(r);
                            processContainers(r);
                            processTables(r);
                            forceCodeLTR(r);
                        });
                        processInput();
                    } else {
                        processAll();
                    }
                }, 50);
            });
            obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else { init(); }
    } catch(e) { console.error('[Claude RTL]', e); }
})();
