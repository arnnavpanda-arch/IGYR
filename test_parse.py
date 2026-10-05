import urllib.parse
query_string = 'original_path='
params = urllib.parse.parse_qs(query_string, keep_blank_values=True)
print(params)
