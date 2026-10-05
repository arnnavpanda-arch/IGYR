import re
with open('api/index.py', 'r') as f:
    content = f.read()

old_logic = """        if 'original_path' in params:
            orig_path = '/' + params['original_path'][0]
            environ['PATH_INFO'] = orig_path
            
            new_params = {k: v for k, v in params.items() if k != 'original_path'}
            environ['QUERY_STRING'] = urllib.parse.urlencode(new_params, doseq=True)"""

new_logic = """        if 'original_path' in params:
            orig_path = '/' + params['original_path'][0]
            environ['PATH_INFO'] = orig_path
            
            new_params = {k: v for k, v in params.items() if k != 'original_path'}
            environ['QUERY_STRING'] = urllib.parse.urlencode(new_params, doseq=True)
        elif environ.get('PATH_INFO') == '/api/index.py':
            # Fallback if Vercel strips the query parameter for some reason
            environ['PATH_INFO'] = '/'"""

content = content.replace(old_logic, new_logic)

with open('api/index.py', 'w') as f:
    f.write(content)
print("Patched api/index.py")
