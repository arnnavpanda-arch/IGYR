import re
with open('backend/app.py', 'r') as f:
    content = f.read()

# Delete serve_static and 404 handler
to_delete = """@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    import os
    from flask import send_from_directory, jsonify
    
    # Check root directory first
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.exists(os.path.join(root_dir, path)):
        return send_from_directory(root_dir, path)
        
    # Check frontend directory second (in case git didn't move them)
    frontend_dir = os.path.join(root_dir, 'frontend')
    if os.path.exists(os.path.join(frontend_dir, path)):
        return send_from_directory(frontend_dir, path)
        
    return jsonify({"error": f"File not found: {path}"}), 404

@app.errorhandler(404)
def not_found(e):
    return serve_static('index.html')"""

if to_delete in content:
    content = content.replace(to_delete, "")
    with open('backend/app.py', 'w') as f:
        f.write(content)
    print("Deleted serve_static")
else:
    print("Could not find serve_static string exactly, trying regex")
    # regex to remove from @app.route('/', defaults={'path': 'index.html'}) to end of not_found
    content = re.sub(r"@app\.route\('/', defaults=\{'path': 'index\.html'\}\).*?def not_found\(e\):\n    return serve_static\('index\.html'\)", "", content, flags=re.DOTALL)
    with open('backend/app.py', 'w') as f:
        f.write(content)
    print("Deleted via regex")
