import traceback
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image
from transformers import pipeline as hf_pipeline

_pipe = None

# Passport-format validation tolerance (15 %).
_PASSPORT_TOL = 0.15


def _passport_ok(w: int, h: int, x1: int, y1: int, x2: int, y2: int) -> bool:
    """Return True when the frame already satisfies passport-photo framing.

    Three conditions must all hold:
      1. Nearly square aspect ratio (within _PASSPORT_TOL).
      2. Face horizontally centred — left and right margins differ by ≤ _PASSPORT_TOL.
      3a. The required crop height fills ≥ (1 - _PASSPORT_TOL) of the frame: the photo
          is already zoomed-in to passport proportions; skip the crop entirely.
      3b. Smaller crop window: must sit within the frame (no padding) and trim ≤
          _PASSPORT_TOL from every edge.

    NOTE: for real passport photos the face is large (fh / h ~ 0.5–0.8), so the crop
    formula produces a window taller than the frame.  Checking out-of-bounds first
    (as the old code did) made _passport_ok always return False for these photos.
    Condition 3a handles this case correctly.
    """
    # 1. Square aspect ratio
    if abs(w - h) / max(w, h) > _PASSPORT_TOL:
        return False
    # 2. Face horizontally centred (left margin ≈ right margin)
    if abs(x1 - (w - x2)) / w > _PASSPORT_TOL:
        return False
    crop_h = y2 - y1
    # 3a. Face already fills the frame height → passport-format zoom level
    if crop_h >= h * (1 - _PASSPORT_TOL):
        return True
    # 3b. Smaller crop: must fit without padding and without over-trimming any edge
    if x1 < 0 or y1 < 0 or x2 > w or y2 > h:
        return False
    max_trim = max(x1 / w, y1 / h, (w - x2) / w, (h - y2) / h)
    return max_trim <= _PASSPORT_TOL


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipe
    print('Loading RMBG-1.4 model...', flush=True)
    _pipe = hf_pipeline('image-segmentation', model='briaai/RMBG-1.4', trust_remote_code=True)
    print('RMBG-1.4 model ready.', flush=True)
    yield


app = FastAPI(lifespan=lifespan)


@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': _pipe is not None}


@app.post('/process')
async def process(
    slot: str = Form(...),
    bg_color: str = Form(''),
    file: UploadFile = File(...),
):
    try:
        input_bytes = await file.read()
        img_array = np.frombuffer(input_bytes, np.uint8)
        img_cv = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img_cv is None:
            raise HTTPException(status_code=400, detail='Failed to decode image')

        h_orig, w_orig = img_cv.shape[:2]
        TARGET_W, TARGET_H = (800, 800) if slot == 'closeup' else (None, None)

        # ── 1. Crop / resize ─────────────────────────────────────────────────
        if slot == 'closeup':
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

            if len(faces) > 0:
                fx, fy, fw, fh = faces[0]
                cx, cy = fx + fw // 2, fy + fh // 2
                crop_h_px = int(fh * 2.8)
                crop_w_px = int(crop_h_px * TARGET_W / TARGET_H)
                x1 = cx - crop_w_px // 2
                y1 = cy - int(fh * 1.1)
                x2 = x1 + crop_w_px
                y2 = y1 + crop_h_px

                if not _passport_ok(w_orig, h_orig, x1, y1, x2, y2):
                    if crop_h_px > min(w_orig, h_orig):
                        # The formula window exceeds the frame (face is large / portrait
                        # photo). Adding padding would zoom the face out drastically.
                        # Instead: clamp to the largest fitting square, keeping the face
                        # at the same proportional headroom (face top at ~21% from top).
                        side = min(w_orig, h_orig)
                        x1_c = max(0, min(cx - side // 2, w_orig - side))
                        y1_c = max(0, min(fy - int(side * 0.6 / 2.8), h_orig - side))
                        img_cv = img_cv[y1_c:y1_c + side, x1_c:x1_c + side]
                    else:
                        # Normal crop — pad with white only where needed.
                        p_left   = max(0, -x1)
                        p_top    = max(0, -y1)
                        p_right  = max(0, x2 - w_orig)
                        p_bottom = max(0, y2 - h_orig)
                        if any([p_left, p_top, p_right, p_bottom]):
                            img_cv = cv2.copyMakeBorder(
                                img_cv, p_top, p_bottom, p_left, p_right,
                                cv2.BORDER_CONSTANT, value=[255, 255, 255])
                            x1 += p_left; x2 += p_left; y1 += p_top; y2 += p_top
                        img_cv = img_cv[y1:y2, x1:x2]
                # else: frame already matches passport framing — skip coordinate-shifting.

            else:
                # No face detected; centre-square crop only when the image is not square.
                if abs(w_orig - h_orig) / max(w_orig, h_orig) > _PASSPORT_TOL:
                    side = min(h_orig, w_orig)
                    cx, cy = w_orig // 2, h_orig // 2
                    img_cv = img_cv[cy - side // 2:cy + side // 2,
                                    cx - side // 2:cx + side // 2]

            img_cv = cv2.resize(img_cv, (TARGET_W, TARGET_H), interpolation=cv2.INTER_CUBIC)

        else:
            scale = min(1.0, 1920 / h_orig)
            img_cv = cv2.resize(
                img_cv,
                (int(w_orig * scale), int(h_orig * scale)),
                interpolation=cv2.INTER_CUBIC)

        # ── 2. Background removal + soft composite ────────────────────────────
        if bg_color:
            pil_img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
            result = _pipe(pil_img, return_mask=True)

            mask_pil = result[0]['mask'] if isinstance(result, list) else result

            alpha = np.array(mask_pil, dtype=np.float32)
            if len(alpha.shape) == 3:
                alpha = cv2.cvtColor(alpha, cv2.COLOR_RGB2GRAY)
            alpha = cv2.resize(alpha, (img_cv.shape[1], img_cv.shape[0]),
                               interpolation=cv2.INTER_CUBIC)
            if alpha.max() > 1.0:
                alpha = alpha / 255.0
            alpha_f = cv2.GaussianBlur(alpha, (3, 3), 0)
            alpha_3d = np.repeat(alpha_f[:, :, np.newaxis], 3, axis=2)
            hex_c = bg_color.lstrip('#')
            r, g, b = int(hex_c[0:2], 16), int(hex_c[2:4], 16), int(hex_c[4:6], 16)
            bg = np.full_like(img_cv, [b, g, r], dtype=np.float32)
            img_cv = (img_cv.astype(np.float32) * alpha_3d
                      + bg * (1 - alpha_3d)).astype(np.uint8)

        # ── 3. Encode and return ──────────────────────────────────────────────
        ok, buf = cv2.imencode('.png', img_cv)
        if not ok:
            raise HTTPException(status_code=500, detail='Failed to encode output image')

        return Response(content=buf.tobytes(), media_type='image/png')

    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail='Image processing failed')
