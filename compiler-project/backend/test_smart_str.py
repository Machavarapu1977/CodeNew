import re

class _SmartStr(str):
    def split(self, sep=None, maxsplit=-1):
        if sep is not None:
            return super().split(sep, maxsplit)
        tokens = super().split(None, maxsplit)
        cleaned = []
        for t in tokens:
            if ',' in t or t.startswith(('[', '(', '{')) or t.endswith((']', ')', '}', ',')):
                sub_tokens = re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[a-zA-Z_]\w*', t)
                if sub_tokens:
                    cleaned.extend(sub_tokens)
                else:
                    _delims = '[],(){}"' + chr(39)
                    stripped = t.strip(_delims)
                    if stripped:
                        cleaned.append(stripped)
            else:
                cleaned.append(t)
        return cleaned or tokens

s = _SmartStr('1, 12, -5, -6, 50, 3')
print('s.split():', s.split())
print('map(int):', list(map(int, s.split())))
