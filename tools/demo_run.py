import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'https://54jxh.github.io/ai-outfit-styler/'
BASE = Path.cwd()
SHOTS = BASE / 'demo_shots'
VIDEO = BASE / 'demo_video'
DEMO = BASE / 'demo'
SHOTS.mkdir(exist_ok=True)
VIDEO.mkdir(exist_ok=True)
DEMO.mkdir(exist_ok=True)

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    context = browser.new_context(
        viewport={'width': 1440, 'height': 900},
        record_video_dir=str(VIDEO),
        record_video_size={'width': 1440, 'height': 900},
    )
    # 拦截外部字体，避免截图等待字体加载
    context.route('**/*.woff*', lambda route: route.abort())
    context.route('**/*.ttf*', lambda route: route.abort())
    context.route('**/fonts.googleapis.com/**', lambda route: route.abort())
    page = context.new_page()
    page.on('console', lambda msg: errors.append(f'console[{msg.type}]: {msg.text[:200]}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {str(exc)[:300]}'))

    def shot(name):
        try:
            page.screenshot(path=str(SHOTS / f'{name}.png'), timeout=8000)
            print('shot:', name)
        except Exception as exc:
            print('shot failed:', name, str(exc)[:100])

    page.goto(URL, wait_until='domcontentloaded', timeout=60000)
    print('step: goto', flush=True)
    page.evaluate('localStorage.clear()')
    page.reload(wait_until='domcontentloaded', timeout=60000)
    page.wait_for_selector('.item-card', timeout=20000)
    page.wait_for_timeout(2500)
    print('step: home', flush=True)
    shot('01_home')

    # 1) 搜索单品（展示单品库）
    page.fill('#searchInput', '白')
    page.wait_for_timeout(1200)
    print('search cards:', page.locator('.item-card').count())
    shot('02_search')
    page.fill('#searchInput', '')
    page.wait_for_timeout(600)
    print('step: search', flush=True)

    # 2) 类别筛选
    page.click('.cat-pill[data-cat="top"]')
    page.wait_for_timeout(900)
    shot('03_category')
    page.click('.cat-pill[data-cat="all"]')
    page.wait_for_timeout(600)
    print('step: category', flush=True)

    # 3) 点击加入搭配（上衣+下装+外套+鞋）
    for item_id in ['t1', 'b1', 'o1', 's1']:
        page.click(f'.item-card[data-id="{item_id}"]')
        page.wait_for_timeout(600)
    page.wait_for_function("document.querySelectorAll('.drop-zone.filled').length >= 4")
    print('filled zones:', page.locator('.drop-zone.filled').count())
    page.wait_for_timeout(700)
    print('step: outfit', flush=True)
    shot('04_outfit')

    # 4) 拖拽配饰（手动鼠标拖拽；失败则点击加入，保证演示不卡住）
    try:
        src = page.locator('.item-card[data-id="a2"]').bounding_box()
        dst = page.locator('.drop-zone[data-cat="accessory"]').bounding_box()
        if src and dst:
            page.mouse.move(src['x'] + src['width'] / 2, src['y'] + src['height'] / 2)
            page.mouse.down()
            page.mouse.move(dst['x'] + dst['width'] / 2, dst['y'] + dst['height'] / 2, steps=12)
            page.wait_for_timeout(300)
            page.mouse.up()
            page.wait_for_timeout(1200)
            print('drag accessory ok')
        else:
            raise RuntimeError('no bounding box')
    except Exception as exc:
        print('drag failed, fallback click:', str(exc)[:120])
        page.click('.item-card[data-id="a2"]')
        page.wait_for_timeout(900)
    print('step: drag', flush=True)
    shot('05_drag')

    # 5) 打开真人照片设置，上传另一张真实照片（演示可换真人）
    page.click('#personPhotoBtn')
    page.wait_for_timeout(1000)
    page.set_input_files('#personPhotoInput', str(BASE / 'images' / 'model_user.webp'))
    page.wait_for_timeout(2500)
    shot('06_person_photo')
    page.click('#personPhotoSaveBtn')
    page.wait_for_timeout(800)
    print('step: person photo saved', flush=True)
    print('person photo saved; preview:', page.evaluate("document.getElementById('personPhotoPreview').src"))

    # 6) AI 真人换装
    page.click('#generateBtn')
    page.wait_for_timeout(2500)
    print('loading:', page.locator('.loading-text').inner_text() if page.locator('.loading-text').count() else '')
    print('step: generate clicked', flush=True)

    result_src = None
    for attempt in range(2):
        for _ in range(60):
            page.wait_for_timeout(2000)
            if page.locator('.result-error').count() > 0:
                err_txt = page.locator('.result-error').inner_text()[:200].encode('ascii', 'replace').decode()
                print('error block:', err_txt)
                page.locator('.result-error button').first.click()
                page.wait_for_timeout(2500)
                break
            imgs = page.locator('#resultDisplay img')
            for i in range(imgs.count()):
                src = imgs.nth(i).get_attribute('src') or ''
                if src.startswith('http') and 'model_real' not in src:
                    result_src = src
                    break
            if result_src:
                break
            if _ % 10 == 0:
                txt = page.locator('.loading-text').inner_text() if page.locator('.loading-text').count() else ''
                print(f'  gen wait {(_+1)*2}s:', txt[:80], flush=True)
        if result_src:
            break
    print('result src:', (result_src or '')[:150])
    page.wait_for_function(
        "() => { const im = document.querySelector('#resultDisplay img'); return im && im.naturalWidth > 0; }",
        timeout=60000,
    )
    page.wait_for_timeout(1800)
    shot('07_result')

    # 7) 下载成果图
    if result_src:
        try:
            with page.expect_download(timeout=20000) as dl_info:
                page.click('#downloadBtn')
            dl = dl_info.value
            dl.save_as(str(BASE / 'demo' / 'outfit_result.webp'))
            print('downloaded:', dl.suggested_filename)
        except Exception as exc:
            print('download failed:', exc)

    # 8) 保存套装并查看套装页
    page.click('#saveOutfitBtn')
    page.wait_for_timeout(900)
    page.click('.tab-btn[data-tab="sets"]')
    page.wait_for_timeout(1100)
    print('sets:', page.locator('.set-card').count())
    shot('08_sets')
    page.click('.tab-btn[data-tab="wardrobe"]')
    page.wait_for_timeout(600)

    # 9) 导出备份
    with page.expect_download() as dl_info:
        page.click('#exportBtn')
    dl = dl_info.value
    dl.save_as(str(BASE / 'demo_backup.json'))
    print('exported:', dl.suggested_filename)
    page.wait_for_timeout(1200)
    shot('09_final')

    video_path = str(page.video.path()) if page.video else None
    page.close()
    context.close()
    browser.close()

print('VIDEO_PATH:', video_path)
print('ERRORS:')
for err in errors[:30]:
    print(err)

# 转成 MP4（使用 imageio-ffmpeg 自带的 ffmpeg）
if video_path:
    webm = Path(video_path)
    mp4 = DEMO / 'AI穿搭搭配工具_操作演示.mp4'
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffmpeg, '-y', '-i', str(webm),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '23', '-preset', 'veryfast', '-movflags', '+faststart',
        str(mp4),
    ]
    print('RUN:', ' '.join(cmd))
    subprocess.run(cmd, check=True)
    print('MP4:', mp4, mp4.stat().st_size if mp4.exists() else 'MISSING')
