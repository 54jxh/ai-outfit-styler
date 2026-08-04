import sys
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR

BASE = Path(r'D:\修好的图\project\demo_shots')
engine = RapidOCR()

for name in sys.argv[1:] or ['01_home.png', '07_result.png']:
    print('=====', name, '=====')
    result, _ = engine(str(BASE / name))
    if result:
        for _box, text, _score in result[:30]:
            print(text)
    else:
        print('NO_TEXT')
