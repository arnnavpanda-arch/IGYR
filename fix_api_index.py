with open('api/index.py', 'w') as f:
    f.write("""import sys
import os

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the Flask app
from backend.app import app
""")
