import urllib.request
import numpy as np
import cv2

# Create dummy image
img = np.full((300, 300, 3), 180, dtype=np.uint8)
img[80:220, 80:220] = [30, 40, 120]
_, buf = cv2.imencode('.jpg', img)

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="image"; filename="lesion.jpg"\r\n'
    f'Content-Type: image/jpeg\r\n\r\n'
).encode('utf-8') + buf.tobytes() + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request(
    'http://127.0.0.1:3000/api/ml/predict',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)
try:
    res = urllib.request.urlopen(req)
    print("STATUS:", res.status)
    content = res.read().decode('utf-8')
    print("RESPONSE (first 500 chars):", content[:500])
except Exception as e:
    print("ERROR:", e)
    if hasattr(e, 'read'):
        print("DETAIL:", e.read().decode('utf-8'))
