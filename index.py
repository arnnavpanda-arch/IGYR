import sys
import os
import urllib.parse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app

class VercelWSGIMiddleware:
    def __init__(self, app):
        self.app = app
    def __call__(self, environ, start_response):
        query_string = environ.get('QUERY_STRING', '')
        params = urllib.parse.parse_qs(query_string, keep_blank_values=True)
        
        if 'original_path' in params:
            orig_path = '/' + params['original_path'][0]
            environ['PATH_INFO'] = orig_path
            
            new_params = {k: v for k, v in params.items() if k != 'original_path'}
            environ['QUERY_STRING'] = urllib.parse.urlencode(new_params, doseq=True)
            
        return self.app(environ, start_response)

app.wsgi_app = VercelWSGIMiddleware(app.wsgi_app)
