"""Seedream adapter. Credentials never leave process memory; results stay on disk.

Contract: https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import threading
import time
import urllib.request
import urllib.error

MODEL = 'doubao-seedream-5-0-pro-260628'
ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
RESULTS = Path(__file__).resolve().parent.parent / '造形生成结果'
MAX_IMAGE = 24 * 1024 * 1024


class ArkRequestError(ValueError):
    def __init__(self, message, details):
        super().__init__(message)
        self.details = details


def request_error(exc):
    """Keep diagnostic identifiers, never provider text echoing prompts or credentials."""
    errors = {400: '服务拒绝了本次生图请求，尚未生成图片。',
              401: '方舟 API Key 无效，请重新配置。',
              402: '方舟账户余额不足，请充值后重试。',
              403: '当前密钥没有该模型的使用权限，请检查方舟控制台。',
              404: '模型不可用，请在火山方舟确认模型权限。',
              429: '额度不足或请求过于频繁，请检查账户后重试。'}
    details = {'httpStatus': exc.code}
    try:
        body = json.loads(exc.read(16384))
        error = body.get('error', {})
        for source, target in [('code', 'code'), ('param', 'parameter')]:
            value = error.get(source)
            if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.\[\]-]{1,120}', value):
                details[target] = value
    except (ValueError, TypeError, AttributeError):
        pass
    request_id = exc.headers.get('X-Request-Id', '') if exc.headers else ''
    if re.fullmatch(r'[A-Za-z0-9_-]{1,160}', request_id):
        details['providerRequestId'] = request_id
    message = errors.get(exc.code, f'方舟生图请求失败（HTTP {exc.code}）。')
    parameter = details.get('parameter', '')
    if exc.code == 400:
        if parameter == 'size':
            message += '服务指出尺寸参数有误，请调整制作规格。'
        elif parameter in ('image', 'images'):
            message += '服务指出参考图参数有误，请检查图片格式与数量。'
        elif parameter == 'prompt':
            message += '服务指出提示词参数有误，请调整文字要求。'
        elif parameter == 'model':
            message += '服务指出模型参数有误，请检查模型可用性。'
        else:
            message += '请检查提示词、参考图片和模型权限；详细代码见错误记录。'
    return ArkRequestError(message, details)


def payload(data, watermark=True):
    prompt = data.get('prompt')
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 50000:
        raise ValueError('提示词为空或过长，请精简后创建新任务。')
    w, h = data.get('w'), data.get('h')
    if type(w) is not int or type(h) is not int or not (921600 <= w*h <= 4624220) or not (1/16 <= w/h <= 16):
        raise ValueError('Seedream Pro 的尺寸需在 92 万至 462 万像素之间，请修改制作规格。')
    refs = data.get('images', [])
    if not isinstance(refs, list) or len(refs) > 10:
        raise ValueError('Seedream Pro 每个任务最多支持 10 张参考图。')
    for src in refs:
        if not isinstance(src, str) or len(src) > MAX_IMAGE*4//3+100 or not re.fullmatch(r'data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+', src):
            raise ValueError('参考图片无效或超过 24MB。')
    result = {'model': MODEL, 'prompt': prompt, 'size': f'{w}x{h}',
              'response_format': 'b64_json', 'output_format': 'png', 'watermark': watermark}
    if refs:
        result['image'] = refs  # Preserve exactly the numbered reference order.
    return result


def generate(key, body):
    req = urllib.request.Request(ENDPOINT, data=json.dumps(body, ensure_ascii=False).encode(),
        headers={'Authorization': 'Bearer '+key, 'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=240) as response:
            raw = response.read(MAX_IMAGE*4//3+1024*1024)
        result = json.loads(raw)
    except urllib.error.HTTPError as exc:
        raise request_error(exc) from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError('连接中断或超时，生成状态不确定。请先检查方舟用量与本地结果目录，避免重复付费。') from None
    rows = result.get('data', [])
    if not rows or not isinstance(rows[0], dict) or not rows[0].get('b64_json'):
        raise RuntimeError('服务未返回可保存的图片，请先检查方舟记录；不要直接重复提交。')
    try:
        image = base64.b64decode(rows[0]['b64_json'], validate=True)
    except (ValueError, TypeError):
        raise RuntimeError('返回图片编码无效，请检查方舟记录。') from None
    if not image.startswith(b'\x89PNG\r\n\x1a\n') or len(image) > MAX_IMAGE:
        raise RuntimeError('返回图片不是预期的 PNG 或超过 24MB，请检查方舟记录。')
    return image


class ImageTasks:
    def __init__(self):
        self.key = ''
        self.watermark = True
        self.lock = threading.Lock()
        self.running = set()

    def paths(self, request_id):
        if not isinstance(request_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,100}', request_id):
            raise ValueError('生成任务标识无效。')
        return RESULTS / (request_id+'.json'), RESULTS / (request_id+'.png')

    def write(self, path, value):
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
        temp.replace(path)

    def get(self, request_id):
        record, picture = self.paths(request_id)
        with self.lock:
            if not record.exists():
                return {'status': 'missing'}
            value = json.loads(record.read_text(encoding='utf-8'))
            if value['status'] == 'running' and request_id not in self.running:
                value.update(status='uncertain', error='服务曾中断，未自动重试。请核对方舟记录后决定是否重新生成。')
            if value['status'] == 'succeeded':
                value['src'] = 'data:image/png;base64,'+base64.b64encode(picture.read_bytes()).decode()
            return {k:v for k,v in value.items() if k != 'digest'}

    def start(self, data):
        request_id = data.get('requestId')
        record, picture = self.paths(request_id)
        body = payload(data, self.watermark)
        digest = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        with self.lock:
            if record.exists():
                existing = json.loads(record.read_text(encoding='utf-8'))
                if existing['digest'] != digest:
                    raise ValueError('任务内容与已提交的版本不同，请创建新任务。')
                return {'status': existing['status'], 'requestId': request_id}
            if not self.key:
                raise ValueError('请先在接口设置中填写火山方舟 API Key。')
            if self.running:
                raise ValueError('已有图片正在生成，请等待完成后再提交。')
            RESULTS.mkdir(parents=True, exist_ok=True)
            value = {'requestId':request_id, 'status':'running', 'model':MODEL,
                     'digest':digest, 'watermark':self.watermark, 'size':body['size'], 'created':time.time()}
            self.write(record, value)
            self.running.add(request_id)
            threading.Thread(target=self.run, args=(self.key, body, value, record, picture), daemon=True).start()
        return {'status':'running', 'requestId':request_id}

    def run(self, key, body, value, record, picture):
        try:
            picture.write_bytes(generate(key, body))
            value.update(status='succeeded', file=picture.name)
        except ValueError as exc:
            value.update(status='failed', error=str(exc))
            if isinstance(exc, ArkRequestError):
                value['errorDetails'] = exc.details
        except RuntimeError as exc:
            value.update(status='uncertain', error=str(exc))
        except Exception:
            value.update(status='uncertain', error='生成或保存未完成，请检查本地结果目录与方舟记录。')
        finally:
            with self.lock:
                self.write(record, value)
                self.running.discard(value['requestId'])
