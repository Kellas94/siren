import os
import sys
import hashlib

def main():
    if len(sys.argv) < 2:
        print("Usage: patch_embed_mermaid.py <siren_file>")
        sys.exit(1)

    target_file = sys.argv[1]
    with open(target_file, "r", encoding="utf-8") as f:
        content = f.read()

    mermaid_file = os.path.join(os.path.dirname(__file__), "..", "mermaid.min.js")
    if not os.path.exists(mermaid_file):
        # try to fallback to the one in antigravity root if run from elsewhere
        mermaid_file = "C:/Claude/SIREN/antigravity/mermaid.min.js"
        if not os.path.exists(mermaid_file):
            print(f"Error: Could not find mermaid.min.js")
            sys.exit(1)

    with open(mermaid_file, "r", encoding="utf-8") as f:
        mermaid_code = f.read()

    anchor = "</head>"
    count = content.count(anchor)
    if count != 7:
        print(f"Error: Expected 7 occurrences of {anchor}, found {count}")
        sys.exit(1)
        
    replacement = f"<script id=\"embedded-mermaid\">\n{mermaid_code}\n</script>\n</head>"
    
    new_content = content.replace(anchor, replacement, 1)

    # We also want to remove the external CDN script loading if we want?
    # No, loadMermaidWithFallbacks will instantly return if window.mermaid exists!
    # So we don't even need to touch loadMermaidWithFallbacks!
    
    tmp_file = target_file + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        f.write(new_content)

    os.replace(tmp_file, target_file)
    print("PATCH APPLIED: Embedded mermaid.min.js inline into HTML")

if __name__ == "__main__":
    main()
