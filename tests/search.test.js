const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compileSearchQuery } = require('../js/search.js');
const papers = require('./fixtures.cjs');

const cases = [
    ['empty query', '  ', papers.map(paper => paper.id)],
    ['AND across fields', 'Card labor', ['wages']],
    ['case-insensitive matching', 'MINIMUM wage', ['wages']],
    ['exact phrase', '"labor market"', ['wages', 'migration', 'power']],
    ['smart quotes', '“labor market”', ['wages', 'migration', 'power']],
    ['excluded word', 'labor -migration', ['wages', 'trade', 'power']],
    ['excluded phrase', 'trade -"trade war"', []],
    ['exclusions without positive terms', '-"trade war" -housing', ['wages', 'inequality', 'migration', 'power', 'tax']],
    ['hyphens within words', 'difference-in-differences', ['tax']],
    ['OR alternatives', 'housing OR poverty', ['inequality', 'housing', 'tax']],
    ['lowercase or is a search term', 'housing or poverty', []],
    ['AND before OR', 'inflation OR poverty education', ['inequality', 'housing', 'tax']],
    ['parenthesized OR with AND', '(inflation OR poverty) education', ['inequality', 'tax']],
    ['nested groups', '((inequality OR poverty) education) OR (title:employment -migration)', ['wages', 'inequality', 'tax']],
    ['excluded group', '-(housing OR migration)', ['wages', 'inequality', 'trade', 'power', 'tax']],
    ['title restriction', 'title:labor', ['power']],
    ['author restriction', 'author:Acemoglu', ['inequality', 'power']],
    ['abstract phrase restriction', 'abstract:"natural experiment"', ['wages']],
    ['case-insensitive field names', 'TITLE:LABOR', ['power']],
    ['field applies to next term only', 'title:employment migration', ['migration']],
    ['field-scoped group', 'title:(labor OR employment)', ['wages', 'migration', 'power']],
    ['nested explicit field overrides group field', 'title:(employment OR author:Acemoglu)', ['wages', 'inequality', 'migration', 'power']],
    ['excluded field', '-author:Smith', ['wages', 'inequality', 'migration', 'tax']],
    ['combined fields and exclusions', 'title:(labor OR employment) -author:Smith', ['wages', 'migration']],
    ['field-scoped exclusion', 'abstract:-migration', ['wages', 'inequality', 'trade', 'power', 'tax']],
    ['field prefix followed by whitespace', 'author: Acemoglu', ['inequality', 'power']],
    ['unscoped year and journal search', '2024 "American Economic Review"', ['wages', 'tax']],
    ['substring compatibility', 'tax', ['tax']],
    ['substring exclusion compatibility', '-tax', ['wages', 'inequality', 'housing', 'trade', 'migration', 'power']]
];

for (const [name, query, expected] of cases) {
    test(name, () => {
        assert.deepEqual(papers.filter(compileSearchQuery(query)).map(paper => paper.id), expected);
    });
}

test('title matching does not include an author mentioned in the abstract', () => {
    const paper = { title: 'Growth', authors: 'Alex Chen', abstract: 'Following Acemoglu.' };
    assert.equal(compileSearchQuery('Acemoglu')(paper), true);
    assert.equal(compileSearchQuery('author:Acemoglu')(paper), false);
});

test('operators and punctuation inside quotes remain literal', () => {
    const paper = { title: 'OR (labor) -migration title:inflation' };
    assert.equal(compileSearchQuery('"OR (labor) -migration title:inflation"')(paper), true);
    assert.equal(compileSearchQuery('"title:employment"')(paper), false);
});

test('quoted phrases support escaped quotes and backslashes', () => {
    assert.equal(compileSearchQuery('"say \\"hello\\""')({ title: 'Say "hello"' }), true);
    assert.equal(compileSearchQuery('"path \\\\data"')({ title: 'Path \\data' }), true);
});

test('missing metadata is treated as empty text', () => {
    assert.equal(compileSearchQuery('author:undefined')({ title: 'Growth' }), false);
    assert.equal(compileSearchQuery('-abstract:inflation')({ title: 'Growth' }), true);
});

for (const query of ['"labor', '""', '()', '(labor OR housing', 'labor)', ')', 'OR labor', 'labor OR', 'labor OR OR housing', '-', 'title:', '- OR labor', '(labor OR)', 'title:()']) {
    test(`invalid syntax produces a hint: ${query}`, () => {
        assert.throws(() => compileSearchQuery(query), SyntaxError);
    });
}
