import json

vercel = {
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.py"
    }
  ]
}

with open('vercel.json', 'w') as f:
    json.dump(vercel, f, indent=2)

