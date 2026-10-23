const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const papers = require('./fixtures.cjs');

// Run the actual browser scripts with small DOM/fetch substitutes, without npm.
function createApp(data = papers) {
    const elements = new Map();
    for (const id of ['keywords', 'yearFrom', 'yearTo', 'results', 'resultsInfo', 'searchError', 'loadMoreTrigger']) {
        elements.set(id, {
            value: '', innerHTML: '', textContent: '', hidden: true, style: {}, attributes: {},
            setAttribute(name, value) { this.attributes[name] = value; }
        });
    }
    const checkboxes = [...new Set(papers.map(paper => paper.journal))]
        .map(value => ({ value, checked: true }));
    const observers = [];
    const context = vm.createContext({
        fixtures: data,
        document: {
            getElementById: id => elements.get(id),
            querySelectorAll: selector => selector.endsWith(':checked')
                ? checkboxes.filter(checkbox => checkbox.checked) : checkboxes,
            addEventListener() {}
        },
        IntersectionObserver: class {
            constructor() { this.disconnected = false; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        console, setTimeout, clearTimeout
    });
    for (const filename of ['search.js', 'script.js']) {
        vm.runInContext(readFileSync(join(__dirname, '..', 'js', filename), 'utf8'), context, { filename });
    }
    vm.runInContext('allPapers = fixtures;', context);

    return {
        context, elements, checkboxes, observers,
        run: code => vm.runInContext(code, context),
        ids: () => Array.from(vm.runInContext('currentResults.map(paper => paper.id)', context)),
        search(query, cached = false) {
            elements.get('keywords').value = query;
            vm.runInContext(cached ? 'performSearchWithCache()' : 'performSearch()', context);
        }
    };
}

test('OR queries still respect selected journals and inclusive year bounds', () => {
    const app = createApp();
    app.checkboxes.forEach(checkbox => { checkbox.checked = checkbox.value === 'American Economic Review'; });
    app.elements.get('yearFrom').value = '2024';
    app.elements.get('yearTo').value = '2024';
    app.search('employment OR poverty');
    assert.deepEqual(app.ids(), ['wages', 'tax']);
});

test('sorting remains newest first, then by title', () => {
    const app = createApp();
    app.search('');
    assert.deepEqual(app.ids(), ['housing', 'migration', 'wages', 'tax', 'inequality', 'trade', 'power']);
});

test('exclusion-only searches still require a selected journal', () => {
    const app = createApp();
    app.checkboxes.forEach(checkbox => { checkbox.checked = false; });
    app.search('-housing');
    assert.deepEqual(app.ids(), []);
    assert.equal(app.elements.get('resultsInfo').style.display, 'flex');
});

test('cache distinguishes uppercase OR from the literal lowercase word', () => {
    const app = createApp();
    app.search('housing OR poverty', true);
    assert.deepEqual(app.ids(), ['housing', 'tax', 'inequality']);
    app.search('housing or poverty', true);
    assert.deepEqual(app.ids(), []);
    app.search('housing OR poverty', true);
    assert.deepEqual(app.ids(), ['housing', 'tax', 'inequality']);
    assert.equal(app.run('searchCache.size'), 2);
});

test('syntax errors clear stale results and recover when returning to a cached query', () => {
    const app = createApp();
    app.search('author:Acemoglu', true);
    app.search('title:(', true);
    assert.deepEqual(app.ids(), []);
    assert.equal(app.elements.get('keywords').attributes['aria-invalid'], 'true');
    assert.equal(app.elements.get('searchError').hidden, false);
    assert.match(app.elements.get('resultsInfo').textContent, /Check your search syntax/);
    assert.doesNotMatch(app.elements.get('results').innerHTML, /paper-card/);
    assert.equal(app.run('searchCache.size'), 1);

    app.search('author:Acemoglu', true);
    assert.deepEqual(app.ids(), ['inequality', 'power']);
    assert.equal(app.elements.get('keywords').attributes['aria-invalid'], 'false');
    assert.equal(app.elements.get('searchError').hidden, true);
    assert.equal(app.elements.get('searchError').textContent, '');
});

test('no-result messages remain visible after journal loading hides the status', () => {
    const app = createApp();
    app.elements.get('resultsInfo').style.display = 'none';
    app.search('title:nonexistent');
    assert.equal(app.elements.get('resultsInfo').style.display, 'flex');
    assert.match(app.elements.get('resultsInfo').textContent, /No papers match your search/);
});

test('new journal data invalidates cached results and is downloaded only once', async () => {
    const app = createApp([papers[0]]);
    const newPaper = { ...papers[0], id: 'new', title: 'New Employment Evidence', year: '2026' };
    let downloads = 0;
    app.context.fetch = async () => {
        downloads++;
        return { ok: true, text: async () => 'CSV fixture' };
    };
    app.context.Papa = { parse: (text, options) => options.complete({ data: [newPaper] }) };
    app.run('availableDataFiles = ["data/American_Economic_Review_2026.csv"];');
    app.search('title:new', true);
    assert.deepEqual(app.ids(), []);
    assert.equal(app.run('searchCache.size'), 1);

    await app.run('loadJournalDataIfNeeded("American Economic Review", true)');
    assert.equal(app.run('searchCache.size'), 0);
    app.search('title:new', true);
    assert.deepEqual(app.ids(), ['new']);
    await app.run('loadJournalDataIfNeeded("American Economic Review", true)');
    assert.equal(downloads, 1);
});

test('large result sets start with 50 cards and invalid queries disconnect scrolling', () => {
    const data = Array.from({ length: 60 }, (_, index) => ({ ...papers[0], id: String(index) }));
    const app = createApp(data);
    app.search('title:employment');
    assert.equal(app.ids().length, 60);
    assert.equal((app.elements.get('results').innerHTML.match(/class="paper-card"/g) || []).length, 50);
    assert.equal(app.observers.length, 1);
    assert.equal(app.observers[0].disconnected, false);
    app.search('employment OR');
    assert.equal(app.observers[0].disconnected, true);
    assert.deepEqual(app.ids(), []);
});
