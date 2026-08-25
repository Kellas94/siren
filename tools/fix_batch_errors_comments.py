r"""[01] The error panel, and [08] comments on right-click.

[01] One missing `]` produced 303 characters of parser token names, pushed the plain-English
     line below the fold, and the gutter marked the line AFTER the real one (Mermaid blames
     the line where the unterminated bracket finally broke). Now: one plain sentence that
     names the likely cause, the true line (found by scanning backwards for an unbalanced
     [ ( { or ") and the raw parser text folded under a "Technical detail" disclosure.
[08] Writing a comment is authoring, so it belongs in the block's right-click menu too:
     "Add comment…" opens the inspector on that block and focuses the comment field. The
     badge that says comments exist stays visible - reading has no right button.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------- [01] parseRenderError: plain sentence + corrected line + folded detail ----------------
i = s.index("      function parseRenderError(error) {")
j = s.index("      }\n", s.index("          display: line ? `Line ${line}: ${cleaned}` : cleaned", i)) + len("      }\n")
old = s[i:j]
new = """      // Mermaid blames the line where an unterminated bracket finally broke the parse -
      // usually the line AFTER the one that opened it. Walk back from the blamed line to
      // the nearest line with an unbalanced [ ( { or ", and name that one instead.
      function locateUnbalancedLine(sourceText, blamedLine) {
        if (!blamedLine) return { line: blamedLine, cause: '' };
        const lines = String(sourceText || '').split(/\\r?\\n/);
        const upto = Math.min(blamedLine, lines.length);
        for (let n = upto; n >= Math.max(1, upto - 12); n--) {
          const text = lines[n - 1] || '';
          if (/^\\s*%%/.test(text)) continue;
          const open = (text.match(/[\\[\\(\\{]/g) || []).length;
          const close = (text.match(/[\\]\\)\\}]/g) || []).length;
          const quotes = (text.match(/"/g) || []).length;
          if (open > close) return { line: n, cause: 'a block label is opened here but never closed - look for a missing ], ) or }' };
          if (quotes % 2 === 1) return { line: n, cause: 'a quote is opened here but never closed' };
        }
        return { line: blamedLine, cause: '' };
      }

      function parseRenderError(error) {
        const raw = String(error && (error.message || error.str || error) || 'Unknown rendering error');
        const lineMatch = raw.match(/(?:line|on line)\\s+(\\d+)/i) || raw.match(/\\b(\\d+):(\\d+)\\b/);
        const blamed = lineMatch ? Number(lineMatch[1]) : null;
        const cleaned = raw.replace(/\\s+/g, ' ').trim().slice(0, 900);
        const rendererRequired = /requires the Full Mermaid renderer/i.test(cleaned);
        if (rendererRequired) {
          const type = detectMermaidDiagramType(el.source?.value || state.source || '');
          return {
            line: null,
            kind: 'warning',
            short: `${diagramTypeLabel(type)} needs the Full Mermaid renderer.`,
            display: cleaned,
            detail: ''
          };
        }
        const located = locateUnbalancedLine(el.source?.value || state.source || '', blamed);
        const line = located.line;
        // A sentence a non-coder can act on, then the parser's own words folded away.
        let plain;
        if (located.cause) plain = `Line ${line}: ${located.cause}.`;
        else if (/Expecting .*got 'EOF'|Unexpected end/i.test(cleaned)) plain = `Line ${line || '?'}: the diagram ends before a statement is finished.`;
        else if (/No diagram type detected/i.test(cleaned)) plain = 'The first line must name the diagram type, for example "flowchart TD".';
        else if (/Lexical error|Unrecognized text/i.test(cleaned)) plain = `Line ${line || '?'}: there is a character Mermaid does not understand here.`;
        else if (line) plain = `Line ${line}: Mermaid could not read this statement.`;
        else plain = 'The diagram source contains an error.';
        return {
          line,
          kind: 'error',
          short: line ? `Source error on line ${line}.` : 'The diagram source contains an error.',
          display: plain,
          detail: cleaned
        };
      }
"""
s = s[:i] + new + s[j:]

# showRenderError: render the folded detail under the plain sentence (use a <details>, monospace)
rep("""        el.editorError.dataset.kind = info.kind;
        el.editorError.textContent = info.display;""",
    """        el.editorError.dataset.kind = info.kind;
        el.editorError.textContent = '';
        const plainLine = document.createElement('div');
        plainLine.className = 'error-plain';
        plainLine.textContent = info.display;
        el.editorError.appendChild(plainLine);
        if (info.detail && info.detail !== info.display) {
          // The parser's own words, kept for whoever wants them, out of the way of the
          // sentence that says what to do. Monospace so its caret pointer lines up.
          const det = document.createElement('details');
          det.className = 'error-detail';
          const sum = document.createElement('summary');
          sum.textContent = 'Technical detail';
          const pre = document.createElement('pre');
          pre.textContent = info.detail;
          det.append(sum, pre);
          el.editorError.appendChild(det);
        }""")

# CSS for the folded detail (anchor on the existing error-line rule, which is unique)
rep("    .line-number.error-line { color: var(--danger); font-weight: 900; background: var(--danger-bg); }",
    """    .line-number.error-line { color: var(--danger); font-weight: 900; background: var(--danger-bg); }
    .error-plain { font-weight: 600; }
    .error-detail { margin-top: 6px; }
    .error-detail > summary { cursor: pointer; font-size: 11.5px; color: var(--muted); }
    .error-detail > pre { margin: 6px 0 0; padding: 6px 8px; max-height: 140px; overflow: auto; font: 11.5px/1.45 ui-monospace, Consolas, 'SF Mono', monospace; white-space: pre; background: var(--panel-alt); border-radius: 4px; }""")

# ---------------- [08] right-click on a block: Add comment… ----------------
rep("""        if (!readOnlyMode) {
          rows.push([() => renameNodeById(id), 'Rename block…', codeOnly]);
          rows.push([() => { setConnectMode(true); handleConnectModeClick(id); }, 'Connect from here', codeOnly]);
          rows.push([() => { selectVisualNode(id); requestDeleteVisualNode(); }, 'Delete block', codeOnly]);
        }""",
    """        if (!readOnlyMode) {
          rows.push([() => renameNodeById(id), 'Rename block…', codeOnly]);
          rows.push([() => { setConnectMode(true); handleConnectModeClick(id); }, 'Connect from here', codeOnly]);
          // Writing a comment is authoring, so it lives here too. Seeing that comments
          // exist stays a visible badge - reading has no right button.
          rows.push([() => {
            openNodeInspector(id, anchor);
            requestAnimationFrame(() => { if (el.nodeCommentText) { el.nodeCommentText.focus(); el.nodeCommentText.scrollIntoView({ block: 'nearest' }); } });
          }, 'Add comment…']);
          rows.push([() => { selectVisualNode(id); requestDeleteVisualNode(); }, 'Delete block', codeOnly]);
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_errors_comments.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('errors+comments applied: %d -> %d chars' % (len(orig), len(s)))
