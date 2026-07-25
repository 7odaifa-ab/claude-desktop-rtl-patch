'use strict';

// Custom text font option (issue #39): the placeholder contract between
// src/rtl-payload.js and patch.ps1's Resolve-CustomFont splice.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const NAME_PLACEHOLDER = '__RTL_CUSTOM_FONT__';
const SCOPE_PLACEHOLDER = '__RTL_CUSTOM_FONT_SCOPE__';
// Mirror $script:CustomFontNameRe / $script:CustomFontScopeRe in patch.ps1 -- keep in sync.
const FONT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,62}$/;
const FONT_SCOPE_RE = /^(all|arabic|hebrew)$/;

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

test('payload carries each font placeholder exactly once', () => {
    // Neither placeholder is a substring of the other ('FONT__' vs 'FONT_SCOPE__'),
    // which is also what keeps patch.ps1's chained .Replace() calls safe.
    assert.ok(!SCOPE_PLACEHOLDER.includes(NAME_PLACEHOLDER));
    assert.strictEqual(payload.split(SCOPE_PLACEHOLDER).length - 1, 1);
    assert.strictEqual(payload.split(NAME_PLACEHOLDER).length - 1, 1);
});

test('assembled payload parses with the placeholders spliced', () => {
    const assembled = assemble();
    for (const name of ['Vazirmatn', 'Noto Naskh Arabic', '']) {
        for (const scope of ['arabic', 'hebrew', 'all']) {
            const spliced = assembled
                .replace(SCOPE_PLACEHOLDER, scope)
                .replace(NAME_PLACEHOLDER, name);
            assert.doesNotThrow(() => new vm.Script(spliced), `parse with '${name}'/${scope}`);
        }
    }
});

test('unreplaced placeholders fall back to off / arabic scope', () => {
    // The payload guards:
    //   if (CUSTOM_FONT.indexOf('__') === 0) CUSTOM_FONT = '';
    //   if (CUSTOM_FONT_SCOPE.indexOf('__') === 0) CUSTOM_FONT_SCOPE = 'arabic';
    assert.match(payload, /CUSTOM_FONT\.indexOf\('__'\) === 0\) CUSTOM_FONT = ''/);
    assert.match(payload, /CUSTOM_FONT_SCOPE\.indexOf\('__'\) === 0\) CUSTOM_FONT_SCOPE = 'arabic'/);
});

test('scope unicode-ranges: arabic and hebrew mapped, all unmapped (no range)', () => {
    assert.match(payload, /arabic: 'U\+0600-06FF/);
    assert.match(payload, /hebrew: 'U\+0590-05FF,U\+FB1D-FB4F'/);
    // 'all' must NOT appear as a RANGES key: it works by omitting unicode-range.
    assert.doesNotMatch(payload, /all: 'U\+/);
});

test('font-name sanitizer admits real names, rejects literal-escape attempts', () => {
    for (const good of ['Vazirmatn', 'Noto Naskh Arabic', 'IRANSansX', 'Scheherazade New', 'Heebo', 'Rubik']) {
        assert.ok(FONT_NAME_RE.test(good), good);
    }
    for (const bad of [
        '', ' leading-space', 'a"),*{direction:ltr}', "x'ics",
        'back\\slash', 'semi;colon', 'a'.repeat(64), '<script>',
    ]) {
        assert.ok(!FONT_NAME_RE.test(bad), JSON.stringify(bad));
    }
});

test('scope sanitizer admits only the three known scopes', () => {
    for (const good of ['all', 'arabic', 'hebrew']) assert.ok(FONT_SCOPE_RE.test(good), good);
    for (const bad of ['', 'latin', 'arabic; }', 'ALL TEXT', '__RTL_CUSTOM_FONT_SCOPE__']) {
        assert.ok(!FONT_SCOPE_RE.test(bad), JSON.stringify(bad));
    }
});
