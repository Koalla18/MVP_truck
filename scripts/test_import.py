import sys, traceback, importlib
sys.path.append(r"C:\Users\Макс\Desktop\balovanie\MVP_truck\backend")
importlib.invalidate_caches()
try:
    m = importlib.import_module('app.main')
    print('OK', m)
except Exception:
    traceback.print_exc()
    print('FAILED')
