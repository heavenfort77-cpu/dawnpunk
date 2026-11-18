# Guard against the mid-line comment trap: a '#' written into the middle of a one-line statement turns the rest of the line into a comment.
# Flags every comment whose text, after a ';', parses as Python code (an assignment, a call, an augmented assignment).
# Usage: python3 commentcheck.py <file.py> ...   (exit 1 and the line numbers if any comment swallowed code); build.py runs it on itself before anything else.
import sys, io, ast, tokenize
import re
KWJ_ = re.compile(r'''\b[A-Za-z_$][\w$]*\s*:\s*(?:-?[\d.]+|\[|['"]|true\b|false\b)[^,:]*,\s*[A-Za-z_$][\w$]*\s*:\s*(?:-?[\d.]+|\[|['"]|true\b|false\b)''')
KW_ = re.compile(r'\b[A-Za-z_]\w*=(?!=)[^,=]+,\s*[A-Za-z_]\w*=(?!=)')
JS_ = re.compile(r'//[^\n]*?;\s*([A-Za-z_$][\w$.\[\]]*\s*(=[^=]|\+=|-=|\*=|\())')
def check_js(path):
    bad = []
    for i, l in enumerate(open(path).read().split('\n')):
        k = l.find('//')
        if k < 0 or not l[:k].strip() or l[:k].count("'") % 2 or l[:k].count('"') % 2 or l[:k].count('`') % 2 or l[k - 1:k] == ':': continue
        m = JS_.search(l[k:]) or KWJ_.search(l[k:])      # also object settings swallowed from a CONFIG line (name: value, name: value)
        if m: bad.append((i + 1, l[k:k + 80]))
    return bad
def check(path):
    if path.endswith(('.js', '.mjs', '.cjs')): return check_js(path)
    bad = []
    for tok in tokenize.generate_tokens(io.StringIO(open(path).read()).readline):
        if tok.type != tokenize.COMMENT or not tok.line[:tok.start[1]].strip(): continue      # a comment on its own line cannot swallow code
        text = tok.string.lstrip('#')
        if KW_.search(text): bad.append((tok.start[0], KW_.search(text).group(0)[:80])); continue      # two or more keyword settings in a row (name=value, name=value) swallowed from a call or CONFIG line
        for part in text.split(';')[1:]:
            part = part.strip()
            if not part: continue
            try: node = ast.parse(part)
            except SyntaxError: continue
            if node.body and isinstance(node.body[0], (ast.Assign, ast.AugAssign, ast.AnnAssign)) or (node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Call)):
                bad.append((tok.start[0], part[:80])); break
    return bad
if __name__ == '__main__':
    n = 0
    for p in sys.argv[1:]:
        for ln, code in check(p): print('COMMENT SWALLOWED CODE %s:%d  -> %s' % (p, ln, code)); n += 1
    print('PASS' if n == 0 else 'FAIL %d' % n); sys.exit(1 if n else 0)
