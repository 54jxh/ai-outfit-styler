import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
BASE = Path(r'D:\修好的图\project')
SHOTS = BASE / 'demo_shots'
VIDEO = BASE / 'demo_video'
SHOTS.mkdir(exist_ok=True)
VIDEO.mkdir(exist_ok=True)

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(
        viewport={'width': 1440, 'height': 900},
        record_video_dir=str(VIDEO),
        record_video_size={'width': 1440, 'height': 900},
    )
    page = context.new_page()
    page.on('console', lambda msg: errors.append(f'console[{msg.type}]: {msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))

    def shot(name):
        page.screenshot(path=str(SHOTS / f'{name}.png'))
        print('shot:', name)

    page.goto(URL, wait_until='domcontentloaded', timeout=30000)
    page.evaluate('localStorage.clear()')
    page.reload(wait_until='domcontentloaded', timeout=30000)
    page.wait_for_selector('.item-card', timeout=15000)
    time.sleep(2)
    shot('01_home')

    # 1) 搜索（名称/备注）
    page.fill('#searchInput', '牛仔裤')
    page.wait_for_timeout(1200)
    print('search 牛仔裤 cards:', page.locator('.item-card').count())
    shot('02_search')
    page.fill('#searchInput', '')
    page.wait_for_timeout(800)

    # 2) 类别筛选
    page.click('.cat-pill[data-cat="top"]')
    page.wait_for_timeout(1000)
    print('top cards:', page.locator('.item-card').count())
    shot('03_category')
    page.click('.cat-pill[data-cat="all"]')
    page.wait_for_timeout(800)

    # 3) 场合筛选
    page.select_option('#occasionFilter', '通勤')
    page.wait_for_timeout(1000)
    print('occasion 通勤 cards:', page.locator('.item-card').count())
    shot('04_occasion')
    page.select_option('#occasionFilter', '')
    page.wait_for_timeout(800)

    # 4) 点击加入搭配
    for item_id in ['t1', 'b1', 'o1', 's1']:
        page.click(f'.item-card[data-id="{item_id}"]')
        page.wait_for_timeout(700)
    page.wait_for_function("document.querySelectorAll('.drop-zone.filled').length >= 4")
    print('filled zones:', page.locator('.drop-zone.filled').count())
    page.wait_for_timeout(800)
    shot('05_outfit')

    # 5) 拖拽配饰
    try:
        page.locator('.item-card[data-id="a2"]').drag_to(page.locator('.drop-zone[data-cat="accessory"]'))
        page.wait_for_timeout(1200)
        print('drag accessory ok, zones:', page.locator('.drop-zone.filled').count())
    except Exception as exc:
        print('drag failed:', exc)
    shot('06_drag')

    # 6) 选择风格
    page.click('.style-btn[data-style="formal"]')
    page.wait_for_timeout(800)

    # 7) 切换快速生成模式
    page.click('#apiKeyBtn')
    page.wait_for_timeout(700)
    page.check('#generateModeRadio')
    page.click('#apiKeySaveBtn')
    page.wait_for_timeout(800)

    # 8) AI 生成穿搭
    page.click('#generateBtn')
    page.wait_for_selector('#resultDisplay img', timeout=180000)
    page.wait_for_function(
        "document.querySelector('#resultDisplay img') && document.querySelector('#resultDisplay img').naturalWidth > 0",
        timeout=60000,
    )
    print('AI result image loaded')
    page.wait_for_timeout(1500)
    shot('07_result')

    # 9) 保存套装 + 套装页
    page.click('#saveOutfitBtn')
    page.wait_for_timeout(1000)
    page.click('.tab-btn[data-tab="sets"]')
    page.wait_for_timeout(1200)
    print('sets count:', page.locator('.set-card').count())
    shot('08_sets')
    page.click('.set-card .btn[data-load]')
    page.wait_for_timeout(1000)
    page.click('.tab-btn[data-tab="wardrobe"]')
    page.wait_for_timeout(800)

    # 10) 添加自定义衣服
    page.click('#addClothingBtn')
    page.wait_for_timeout(700)
    page.fill('#itemName', '灰色连帽卫衣')
    page.fill('#itemNote', '宽松休闲、秋季百搭')
    page.select_option('#itemCategory', 'top')
    page.fill('#itemColor', '灰色')
    page.select_option('#itemSeason', '秋天')
    page.select_option('#itemOccasion', '休闲')
    page.fill('#itemDesc', 'a gray hoodie sweatshirt')
    page.click('#confirmAddBtn')
    page.wait_for_timeout(1000)
    print('custom added; cards on page:', page.locator('.item-card').count())
    shot('09_custom')

    # 11) 导出备份
    with page.expect_download() as dl_info:
        page.click('#exportBtn')
    download = dl_info.value
    download.save_as(str(BASE / 'demo_backup.json'))
    print('exported:', download.suggested_filename)

    page.wait_for_timeout(2500)
    shot('10_final')

    video_path = str(page.video.path()) if page.video else None
    page.close()
    context.close()
    browser.close()

print('VIDEO_PATH:', video_path)
print('ERRORS:')
for err in errors[:40]:
    print(err)
print('DONE')
