import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.on('console', lambda msg: errors.append(f'console[{msg.type}]: {msg.text[:200]}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {str(exc)[:300]}'))

    page.goto(URL, wait_until='domcontentloaded', timeout=30000)
    page.evaluate('localStorage.clear()')
    page.reload(wait_until='domcontentloaded', timeout=30000)
    page.wait_for_selector('.item-card', timeout=15000)
    page.wait_for_timeout(1500)

    # 检查真人照片预览
    src = page.evaluate("document.getElementById('personPhotoPreview').src")
    print('person preview src:', src)
    assert 'model_real_00034' in src, 'person preview wrong'

    # 未选单品时按钮应禁用
    print('generate disabled without items:', page.is_disabled('#generateBtn'))

    # 选择单品
    for item_id in ['t1', 'b1', 'o1', 's1']:
        page.click(f'.item-card[data-id="{item_id}"]')
        page.wait_for_timeout(400)
    print('filled zones:', page.locator('.drop-zone.filled').count())

    # 点击 AI 真人换装
    page.click('#generateBtn')
    page.wait_for_timeout(3000)
    print('loading text:', page.locator('.loading-text').inner_text() if page.locator('.loading-text').count() else 'none')

    # 等待结果图片或错误
    result_img = None
    error_seen = False
    for _ in range(150):
        page.wait_for_timeout(2000)
        if page.locator('.result-error').count() > 0:
            error_seen = True
            print('ERROR BLOCK:', page.locator('.result-error').inner_text()[:300])
            break
        imgs = page.locator('#resultDisplay img')
        for i in range(imgs.count()):
            el = imgs.nth(i)
            src2 = el.get_attribute('src') or ''
            if src2.startswith('http') and 'model_real' not in src2 and 'data:' not in src2:
                result_img = src2
                break
        if result_img:
            print('RESULT IMG:', result_img[:200])
            break
        if _ % 15 == 0:
            txt = page.locator('.loading-text').inner_text() if page.locator('.loading-text').count() else ''
            print(f'  waiting {(_+1)*2}s ...', txt[:80])

    page.screenshot(path=str(Path.cwd() / 'tools' / 'smoke_result.png'))
    print('error_seen:', error_seen)
    print('console errors:', json.dumps(errors, ensure_ascii=False)[:2000])
    browser.close()
