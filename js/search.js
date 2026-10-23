const SEARCH_FIELDS = {
    title: 'title',
    author: 'authors',
    abstract: 'abstract'
};

// Keep operators separate from quoted text and hyphens inside words.
function tokenizeSearchQuery(query) {
    const tokens = [];
    const text = query.replace(/[“”]/g, '"');
    let index = 0;

    while (index < text.length) {
        const character = text[index];
        if (/\s/.test(character)) {
            index++;
            continue;
        }

        if (character === '(' || character === ')' || character === '-') {
            tokens.push({ type: character });
            index++;
            continue;
        }

        if (character === '"') {
            let value = '';
            index++;
            while (index < text.length && text[index] !== '"') {
                if (text[index] === '\\' && /["\\]/.test(text[index + 1] || '')) {
                    index++;
                }
                value += text[index++];
            }
            if (index === text.length) {
                throw new SyntaxError('Close the phrase with a double quote (").');
            }
            if (!value.trim()) {
                throw new SyntaxError('Enter a word or phrase between the quotes.');
            }
            tokens.push({ type: 'term', value: value.toLowerCase() });
            index++;
            continue;
        }

        const field = /^(title|author|abstract):/i.exec(text.slice(index));
        if (field) {
            tokens.push({ type: 'field', value: field[1].toLowerCase() });
            index += field[0].length;
            continue;
        }

        const start = index;
        while (index < text.length && !/[\s()"]/.test(text[index])) {
            index++;
        }
        const value = text.slice(start, index);
        tokens.push(value === 'OR'
            ? { type: 'OR' }
            : { type: 'term', value: value.toLowerCase() });
    }

    return tokens;
}

// Parse once per search. Precedence: exclusion, whitespace (AND), then OR.
function compileSearchQuery(query) {
    const tokens = tokenizeSearchQuery(query);
    let position = 0;

    function parseOr() {
        const alternatives = [parseAnd()];
        while (tokens[position]?.type === 'OR') {
            position++;
            alternatives.push(parseAnd());
        }
        return (text, field) => alternatives.some(matches => matches(text, field));
    }

    function parseAnd() {
        const conditions = [];
        while (position < tokens.length && !['OR', ')'].includes(tokens[position].type)) {
            conditions.push(parseCondition());
        }
        if (conditions.length === 0) {
            throw new SyntaxError('Add a search condition on each side of OR and inside parentheses.');
        }
        return (text, field) => conditions.every(matches => matches(text, field));
    }

    function parseCondition() {
        const token = tokens[position++];
        if (!token || token.type === 'OR' || token.type === ')') {
            throw new SyntaxError("Enter a search condition after '-' or a field prefix.");
        }

        if (token.type === '-') {
            const matches = parseCondition();
            return (text, field) => !matches(text, field);
        }

        if (token.type === 'field') {
            const matches = parseCondition();
            return text => matches(text, token.value);
        }

        if (token.type === '(') {
            const matches = parseOr();
            if (tokens[position]?.type !== ')') {
                throw new SyntaxError("Add a closing parenthesis ')'.");
            }
            position++;
            return matches;
        }

        return (text, field = 'all') => text[field].includes(token.value);
    }

    if (tokens.length === 0) return () => true;

    const matches = parseOr();
    if (position < tokens.length) {
        throw new SyntaxError("Remove the extra closing parenthesis ')'.");
    }

    return paper => {
        const text = {};
        for (const [field, property] of Object.entries(SEARCH_FIELDS)) {
            text[field] = String(paper[property] ?? '').toLowerCase();
        }
        text.all = [paper.journal, paper.year, text.title, text.author, text.abstract]
            .join(' ').toLowerCase();
        return matches(text);
    };
}

// The browser uses the function directly; Node's test runner imports it here.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compileSearchQuery };
}
