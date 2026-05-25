import sys
import cv2
import numpy as np
from PIL import Image
from transformers import pipeline

slot = sys.argv[1]
bg_color = sys.argv[2] if len(sys.argv) > 2 else ''

input_bytes = sys.stdin.buffer.read()
img_array = np.frombuffer(input_bytes, np.uint8)
img_cv = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
if img_cv is None:
    print('remove_bg: failed to decode input image', file=sys.stderr)
    sys.exit(1)

h_orig, w_orig = img_cv.shape[:2]

TARGET_W, TARGET_H = (800, 800) if slot == 'closeup' else (None, None)

if slot == 'closeup':
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    if len(faces) > 0:
        x, y, w, h = faces[0]
        cx, cy = x + w // 2, y + h // 2
        crop_h = int(h * 2.8)
        crop_w = int(crop_h * TARGET_W / TARGET_H)
        x1, y1 = cx - crop_w // 2, cy - int(h * 1.1)
        x2, y2 = x1 + crop_w, y1 + crop_h
        p_left = max(0, -x1)
        p_top = max(0, -y1)
        p_right = max(0, x2 - w_orig)
        p_bottom = max(0, y2 - h_orig)
        if any([p_left, p_top, p_right, p_bottom]):
            img_cv = cv2.copyMakeBorder(img_cv, p_top, p_bottom, p_left, p_right,
                                        cv2.BORDER_CONSTANT, value=[255, 255, 255])
            x1 += p_left; x2 += p_left; y1 += p_top; y2 += p_top
        img_cv = img_cv[y1:y2, x1:x2]
    else:
        side = min(h_orig, w_orig)
        cx, cy = w_orig // 2, h_orig // 2
        img_cv = img_cv[cy - side // 2:cy + side // 2, cx - side // 2:cx + side // 2]

    img_cv = cv2.resize(img_cv, (TARGET_W, TARGET_H), interpolation=cv2.INTER_CUBIC)

else:
    scale = min(1.0, 1920 / h_orig)
    img_cv = cv2.resize(img_cv, (int(w_orig * scale), int(h_orig * scale)),
                        interpolation=cv2.INTER_CUBIC)

if bg_color:
    pipe = pipeline('image-segmentation', model='briaai/RMBG-1.4',
                    trust_remote_code=True)
    pil_img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
    mask_pil = pipe(pil_img, return_mask=True)
    alpha = np.array(mask_pil, dtype=np.float32)
    if len(alpha.shape) == 3:
        alpha = cv2.cvtColor(alpha, cv2.COLOR_RGB2GRAY)
    alpha = cv2.resize(alpha, (img_cv.shape[1], img_cv.shape[0]),
                       interpolation=cv2.INTER_CUBIC)
    alpha_f = cv2.GaussianBlur(alpha, (3, 3), 0) / 255.0
    alpha_3d = np.repeat(alpha_f[:, :, np.newaxis], 3, axis=2)
    hex_c = bg_color.lstrip('#')
    r, g, b = int(hex_c[0:2], 16), int(hex_c[2:4], 16), int(hex_c[4:6], 16)
    bg = np.full_like(img_cv, [b, g, r], dtype=np.float32)
    img_cv = (img_cv.astype(np.float32) * alpha_3d + bg * (1 - alpha_3d)).astype(np.uint8)

ok, buf = cv2.imencode('.png', img_cv)
if not ok:
    print('remove_bg: cv2.imencode failed', file=sys.stderr)
    sys.exit(1)
sys.stdout.buffer.write(buf.tobytes())
