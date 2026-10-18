"""Windows current-user encrypted credentials, kept outside the distributable app."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import threading

STORE = Path(__file__).resolve().parent.parent / '.造形本机配置' / 'credentials.dpapi'
LOCK = threading.Lock()


class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]


def crypt(data, decrypt=False):
    if os.name != 'nt':
        raise ValueError('本机加密保存需要 Windows。')
    buf = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)))
    result = Blob()
    api = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if decrypt:
        ok = api.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result))
    else:
        ok = api.CryptProtectData(ctypes.byref(source), 'Art workbench', None, None, None, 1, ctypes.byref(result))
    if not ok:
        raise ValueError('本机密钥加密读取或保存失败。')
    try:
        return ctypes.string_at(result.data, result.size)
    finally:
        kernel.LocalFree(result.data)


def load():
    if not STORE.exists():
        return {}
    try:
        value = json.loads(crypt(STORE.read_bytes(), decrypt=True))
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except Exception:
        raise ValueError('无法读取本机加密配置，请在接口设置中重新连接。') from None


def save(name, value):
    if name not in ('deepseek', 'ark', 'watermark'):
        raise ValueError('未知配置项。')
    with LOCK:
        data = load()
        data[name] = value
        encoded = crypt(json.dumps(data).encode('utf-8'))
        STORE.parent.mkdir(parents=True, exist_ok=True)
        temp = STORE.with_suffix('.tmp')
        temp.write_bytes(encoded)
        os.replace(temp, STORE)
