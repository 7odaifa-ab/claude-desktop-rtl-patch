'use strict';

// Arabic-script font option (issue #39): the placeholder contract between
// src/rtl-payload.js and patch.ps1's Resolve-ArabicScriptFont splice.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PLACEHOLDER = '__RTL_ARABIC_FONT__';
// Mirrors $script:ArabicFontNameRe in patch.ps1 -- keep in sync.
const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,62}$/;

const payload = fs.readFileSync(path.join(__dirname, '..', 'src', 'rtl-payload.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', 'src', 'rtl-core.js'), 'utf8');

// Assemble exactly like tools/build-payload.ps1: strip the core's CommonJS
// guard, inline it at the marker.
function assemble() {
    let c = core;
    const guardIdx = c.indexOf('if (typeof module !==');
    if (guardIdx >= 0) c = c.slice(0, guardIdx).trimEnd() + '\n';
    const marker = '/*__RTL_CORE__*/';
    assert.ok(payload.includes(marker), 'core marker present in payload');
    // Function replacement: a string replacement would expand $-patterns in the
    // core (build-payload.ps1 uses .NET String.Replace, which is literal).
    return payload.replace(marker, () => c.trimEnd());
}

test('payload carries the font placeholder exactly once', () => {
    const count = payload.split(PLACEHOLDER).length - 1;
    assert.strictEqual(count, 1);
});

test('assembled payload parses with the placeholder spliced', () => {
    const assembled = assemble();
    for (const name of ['Vazirmatn', 'Noto Naskh Arabic', '']) {
        const spliced = assembled.replace(PLACEHOLDER, name);
        assert.doesNotThrow(() => new vm.Script(spliced), `parse with '${name}'`);
    }
});

test('unreplaced placeholder is treated as feature-off, not a font name', () => {
    // The payload guards: if (ARABIC_FONT.indexOf('__') === 0) ARABIC_FONT = '';
    assert.match(payload, /ARABIC_FONT\.indexOf\('__'\) === 0/);
});

test('font-name sanitizer admits real names, rejects literal-escape attempts', () => {
    for (const good of ['Vazirmatn', 'Noto Naskh Arabic', 'IRANSansX', 'Scheherazade New']) {
        assert.ok(FONT_NAME_RE.test(good), good);
    }
    for (const bad of [
        '', ' leading-space', 'a"),*{direction:ltr}', "x'ics",
        'back\\slash', 'semi;colon', 'a'.repeat(64), '<script>',
    ]) {
        assert.ok(!FONT_NAME_RE.test(bad), JSON.stringify(bad));
    }
});
