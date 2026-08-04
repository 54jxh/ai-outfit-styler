#!/usr/bin/env python3
"""
AI 穿搭搭配工具 - 本地代理服务器
功能：
1. 提供静态文件服务 (HTML/CSS/JS/图片)
2. 代理 IDM-VTON 虚拟试衣 API（避免浏览器CORS问题）
3. 代理 Pollinations 文生图 API

运行方式: python server.py
访问地址: http://localhost:8899/
"""

import http.server
import socketserver
import json
import os
import ssl
import urllib.request
import urllib.parse
import time
import io
import threading
import socket

# 设置socket默认超时（关键！否则SSE流的read()会无限阻塞）
socket.setdefaulttimeout(10)

# ========== 配置 ==========
PORT = 8899
WEB_DIR = os.path.dirname(os.path.abspath(__file__))
IDM_VTON_BASE = 'https://yisol-idm-vton.hf.space'
POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt/'
VTRYON_TIMEOUT = 90  # 90秒超时（正常试衣30-50秒，留余量）

# SSL context (忽略证书验证，用于开发环境)
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# ========== MIME 类型 ==========
MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
}


class OutfitHandler(http.server.BaseHTTPRequestHandler):
    """处理静态文件和API代理请求"""

    def log_message(self, format, *args):
        # 简化日志
        msg = format % args
        if '/api/' in msg or 'ERROR' in msg.upper():
            print(f'[{time.strftime("%H:%M:%S")}] {msg}')

    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        """处理 GET 请求：静态文件 或 API代理"""
        parsed = urllib.parse.urlparse(self.path)

        # API 路由
        if parsed.path == '/api/health':
            self._json_response({'status': 'ok'})
            return

        if parsed.path == '/api/check-server':
            self._check_idm_vton()
            return

        if parsed.path.startswith('/api/proxy-image/'):
            # 代理图片下载（用于下载IDM-VTON结果图片）
            self._proxy_image(parsed.path.replace('/api/proxy-image/', ''))
            return

        # 静态文件服务
        self._serve_static(parsed.path)

    def do_POST(self):
        """处理 POST 请求：API代理"""
        import sys
        print(f'POST {self.path}', flush=True)
        sys.stdout.flush()
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/api/tryon':
            self._handle_tryon()
            return

        if parsed.path == '/api/generate':
            self._handle_generate()
            return

        self.send_error(404, 'Not Found')

    # ========== CORS ==========
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    # ========== JSON 响应 ==========
    def _json_response(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    # ========== 静态文件 ==========
    def _serve_static(self, path):
        if path == '/' or path == '':
            path = '/index.html'

        # 安全检查：防止目录遍历
        file_path = os.path.normpath(os.path.join(WEB_DIR, path.lstrip('/')))
        if not file_path.startswith(WEB_DIR):
            self.send_error(403, 'Forbidden')
            return

        if not os.path.isfile(file_path):
            self.send_error(404, 'Not Found')
            return

        # 获取 MIME 类型
        ext = os.path.splitext(file_path)[1].lower()
        content_type = MIME_TYPES.get(ext, 'application/octet-stream')

        with open(file_path, 'rb') as f:
            content = f.read()

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', len(content))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(content)

    # ========== 检查 IDM-VTON 服务器状态 ==========
    def _check_idm_vton(self):
        try:
            req = urllib.request.Request(
                f'{IDM_VTON_BASE}/config',
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=15)
            if resp.status == 200:
                self._json_response({'status': 'ok', 'message': 'AI服务器在线'})
            else:
                self._json_response({'status': 'error', 'message': f'服务器返回 {resp.status}'})
        except Exception as e:
            self._json_response({'status': 'error', 'message': f'无法连接: {str(e)}'})

    # ========== 虚拟试衣 API ==========
    def _handle_tryon(self):
        """处理虚拟试衣请求：接收模特和服装图片，调用IDM-VTON API"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            model_image = data.get('modelImage')  # base64 或文件路径
            garment_image = data.get('garmentImage')
            garment_des = data.get('garmentDes', 'a stylish garment')

            print(f'\n{"="*60}')
            print(f'虚拟试衣请求')
            print(f'  模特图片路径: {model_image}')
            print(f'  服装图片路径: {garment_image}')
            print(f'  服装描述: {garment_des}')
            print(f'{"="*60}')

            # 1. 准备图片数据
            model_data = self._get_image_data(model_image, 'model')
            garment_data = self._get_image_data(garment_image, 'garment')

            print(f'  模特图片数据: {len(model_data) if model_data else "None"} bytes')
            print(f'  服装图片数据: {len(garment_data) if garment_data else "None"} bytes')

            if not model_data or not garment_data:
                self._json_response({'error': '图片数据无效'}, 400)
                return

            # 2. 唤醒 IDM-VTON Space
            print('[1/5] 正在连接AI服务器...')
            self._ensure_server_awake()

            # 3. 上传模特图片
            print('[2/5] 正在上传模特图片...')
            model_path = self._upload_image(model_data, 'model.png', 'image/png')
            print(f'  模特路径: {model_path}')

            # 4. 上传服装图片
            print('[3/5] 正在上传服装图片...')
            garment_path = self._upload_image(garment_data, 'garment.jpg', 'image/jpeg')
            print(f'  服装路径: {garment_path}')

            # 5. 提交试衣请求
            print('[4/5] 正在提交试衣请求...')
            event_id = self._submit_tryon(model_path, garment_path, garment_des)
            print(f'  事件ID: {event_id}')

            # 6. 轮询获取结果
            print('[5/5] AI正在换装中...')
            result_url = self._poll_result(event_id)
            print(f'  结果URL: {result_url}')

            if result_url:
                self._json_response({
                    'success': True,
                    'resultUrl': f'/api/proxy-image/{urllib.parse.quote(result_url, safe="")}',
                    'directUrl': result_url,
                })
            else:
                self._json_response({'error': '虚拟试衣超时'}, 504)

        except Exception as e:
            print(f'虚拟试衣错误: {e}')
            import traceback
            traceback.print_exc()
            self._json_response({'error': str(e)}, 500)

    def _get_image_data(self, image_ref, name):
        """从base64或文件路径获取图片二进制数据"""
        if not image_ref:
            return None

        # base64 data URI
        if image_ref.startswith('data:'):
            # 格式: data:image/png;base64,xxxx
            header, data = image_ref.split(',', 1)
            import base64
            return base64.b64decode(data)

        # 本地文件路径
        if image_ref.startswith('images/'):
            file_path = os.path.join(WEB_DIR, image_ref)
        elif image_ref.startswith('/'):
            file_path = os.path.join(WEB_DIR, image_ref.lstrip('/'))
        else:
            file_path = os.path.join(WEB_DIR, image_ref)

        if os.path.isfile(file_path):
            with open(file_path, 'rb') as f:
                return f.read()

        print(f'  [警告] 图片文件不存在: {file_path}')
        return None

    def _ensure_server_awake(self):
        """确保IDM-VTON Space已唤醒 - 快速失败"""
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    f'{IDM_VTON_BASE}/config',
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=10)
                if resp.status == 200:
                    return
            except Exception as e:
                print(f'  连接尝试 {attempt+1}/2 失败: {e}')
                if attempt == 0:
                    time.sleep(3)

        raise Exception('无法连接AI服务器，请稍后重试')

    def _upload_image(self, image_data, filename, content_type):
        """上传图片到IDM-VTON"""
        boundary = '----FormBoundary7MA4YWxkTrZu0gW'
        body = (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'
            f'Content-Type: {content_type}\r\n\r\n'
        ).encode() + image_data + f'\r\n--{boundary}--\r\n'.encode()

        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    f'{IDM_VTON_BASE}/upload',
                    data=body,
                    headers={
                        'Content-Type': f'multipart/form-data; boundary={boundary}',
                        'User-Agent': 'Mozilla/5.0',
                    }
                )
                resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=20)
                result = json.loads(resp.read().decode())
                if result and result[0]:
                    return result[0]
            except Exception as e:
                print(f'  上传重试 {attempt+1}/2: {e}')
                if attempt == 0:
                    time.sleep(2)

        raise Exception(f'上传图片失败: {filename}')

    def _submit_tryon(self, model_path, garment_path, garment_des):
        """提交试衣请求"""
        submit_body = json.dumps({
            'data': [
                {
                    'background': {'path': model_path, 'meta': {'_type': 'gradio.FileData'}},
                    'layers': [],
                    'composite': None,
                },
                {'path': garment_path, 'meta': {'_type': 'gradio.FileData'}},
                garment_des,
                True,   # is_checked (自动遮罩)
                False,  # is_checked_crop
                30,     # denoise_steps
                42,     # seed
            ]
        }).encode()

        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    f'{IDM_VTON_BASE}/call/tryon',
                    data=submit_body,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0',
                    }
                )
                resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=30)
                result = json.loads(resp.read().decode())
                event_id = result.get('event_id')
                if event_id:
                    return event_id
            except Exception as e:
                print(f'  提交重试 {attempt+1}/3: {e}')
                time.sleep(3)

        raise Exception('提交试衣请求失败')

    def _poll_result(self, event_id):
        """轮询获取试衣结果 - 快速失败优化
        关键点：SSE流不会主动结束，所以每次轮询只读一小段，
        没有完成事件就关闭连接，等下一轮再连。
        任何错误立即返回，不让用户傻等。
        """
        result_url = f'{IDM_VTON_BASE}/call/tryon/{event_id}'
        start = time.time()
        poll_interval = 3  # 轮询间隔秒数
        read_timeout = 5   # 单次读取超时秒数

        while time.time() - start < VTRYON_TIMEOUT:
            elapsed = int(time.time() - start)
            print(f'  [{elapsed}s] 等待AI处理结果...')

            try:
                req = urllib.request.Request(
                    result_url,
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=read_timeout)

                # 读取一小段就停，不要等整个流结束
                result_text = ''
                try:
                    # 分小块读取，最多读几秒
                    read_start = time.time()
                    while time.time() - read_start < read_timeout - 1:
                        chunk = resp.read(128)
                        if not chunk:
                            break
                        result_text += chunk.decode('utf-8', errors='ignore')
                        if 'event: complete' in result_text or 'event: error' in result_text:
                            break
                except Exception:
                    pass  # 读超时是正常的，SSE流不会结束

                # 关闭连接（重要！不然连接会一直占着）
                try:
                    resp.close()
                except Exception:
                    pass

                if 'event: complete' in result_text:
                    for line in result_text.split('\n'):
                        if line.startswith('data:'):
                            data_str = line[5:].strip()
                            if data_str and data_str != 'null':
                                data = json.loads(data_str)
                                if data and data[0]:
                                    url = data[0].get('url') or f'{IDM_VTON_BASE}/file={data[0].get("path", "")}'
                                    return url
                    print(f'  [警告] complete但未找到数据')
                    return None

                elif 'event: error' in result_text:
                    # IDM-VTON返回error就不会再有后续结果了，直接失败
                    print(f'  [错误] AI处理出错，立即失败')
                    raise Exception('AI虚拟试衣服务器暂时不可用，可切换到快速生成模式')

                else:
                    # 还在处理中，重置错误计数
                    error_count = 0

            except Exception as e:
                if 'AI虚拟试衣服务器暂时不可用' in str(e):
                    raise
                # 任何网络错误都直接失败（SSE流不应该超时，超时说明有问题）
                print(f'  [错误] 网络异常: {str(e)[:80]}')
                raise Exception('AI虚拟试衣服务器暂时不可用，可切换到快速生成模式')

            # 等待下一轮
            time.sleep(poll_interval)

        return None

    # ========== 图片代理 ==========
    def _proxy_image(self, encoded_url):
        """代理下载图片（避免CORS问题）"""
        try:
            image_url = urllib.parse.unquote(encoded_url)
            req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=30)
            content = resp.read()

            content_type = resp.headers.get('Content-Type', 'image/png')

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            print(f'图片代理错误: {e}')
            self.send_error(502, f'图片下载失败: {str(e)}')

    # ========== Pollinations 文生图 ==========
    def _handle_generate(self):
        """处理Pollinations文生图请求"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            prompt = data.get('prompt', '')
            width = data.get('width', 576)
            height = data.get('height', 832)
            seed = data.get('seed', 42)

            encoded_prompt = urllib.parse.quote(prompt)
            image_url = f'{POLLINATIONS_BASE}{encoded_prompt}?width={width}&height={height}&model=flux&nologo=true&seed={seed}'

            print(f'Pollinations生成: {prompt[:80]}...')

            # 下载图片
            req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, context=SSL_CTX, timeout=120)
            content = resp.read()

            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(content)

        except Exception as e:
            print(f'文生图错误: {e}')
            self._json_response({'error': str(e)}, 500)


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """多线程HTTP服务器，支持同时处理多个请求"""
    daemon_threads = True
    allow_reuse_address = True


def main():
    os.chdir(WEB_DIR)
    print(f'静态文件目录: {WEB_DIR}')
    print(f'启动服务器: http://localhost:{PORT}/')
    print(f'按 Ctrl+C 停止')
    print(f'{"="*60}')

    with ThreadingHTTPServer(('0.0.0.0', PORT), OutfitHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n服务器已停止')


if __name__ == '__main__':
    main()
