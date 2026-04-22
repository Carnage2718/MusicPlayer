import os
import uuid
import random
import requests
import boto3
from botocore.client import Config
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from typing import List

load_dotenv()

# =========================
# R2 CLIENT
# =========================
r2 = boto3.client(
    "s3",
    endpoint_url=os.getenv("R2_ENDPOINT_URL"),
    aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    region_name="auto",
    config=Config(signature_version="s3v4")
)

BUCKET = os.getenv("R2_BUCKET")


# =========================
# R2 UPLOAD
# =========================
def upload_bytes_to_r2(data: bytes) -> str:
    filename = f"{uuid.uuid4()}.jpg"
    key = f"cover/playlist/{filename}"

    try:
        r2.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=data,
            ContentType="image/jpeg"
        )
    except Exception as e:
        raise RuntimeError(f"R2 upload failed: {e}")

    return key


# =========================
# SAVE FROM URL
# =========================
def generate_dummy_bytes():
    img = Image.new("RGB", (500, 500), (29,185,84))
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer.read()

def save_cover_from_url(url: str) -> str:
    try:
        res = requests.get(url, timeout=5)
        res.raise_for_status()
        return upload_bytes_to_r2(res.content)
    except:
        # 🔥 fallback（絶対に失敗しない）
        return upload_bytes_to_r2(generate_dummy_bytes())

# =========================
# RANDOM COVER
# =========================
def generate_random_cover() -> str:
    colors = [
        "1db954", "ff4d4f", "1890ff",
        "722ed1", "fa8c16", "13c2c2"
    ]

    bg = random.choice(colors)

    return f"https://dummyimage.com/600x600/{bg}/ffffff&text=Playlist"


# =========================
# COLOR EXTRACTION
# =========================
def extract_color(url: str):
    try:
        res = requests.get(url, timeout=3, headers={"User-Agent": "Mozilla/5.0"})
        img = Image.open(BytesIO(res.content)).convert("RGB")
        img = img.resize((50, 50))

        pixels = list(img.getdata())
        avg = tuple(sum(c)//len(c) for c in zip(*pixels))

        return avg
    
    except Exception as e:
        return None


# =========================
# SMART COVER（必ずR2保存）
# =========================

def generate_smart_cover(image_urls: list[str], title: str = "Playlist") -> str:

    size = 500
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)

    # =========================
    # 🎨 COLOR生成
    # =========================
    base_colors = []

    for url in image_urls[:4]:
        color = extract_color(url)
        if color:
            base_colors.append(color)

    fallback = [
        (29,185,84),
        (255,99,132),
        (54,162,235),
        (255,206,86),
        (153,102,255)
    ]

    if not base_colors:
        base_colors = random.sample(fallback, 2)

    c1 = random.choice(base_colors)
    c2 = random.choice(base_colors if len(base_colors) > 1 else fallback)

    # =========================
    # 🌈 グラデーション背景
    # =========================
    for y in range(size):
        ratio = y / size
        r = int(c1[0]*(1-ratio) + c2[0]*ratio)
        g = int(c1[1]*(1-ratio) + c2[1]*ratio)
        b = int(c1[2]*(1-ratio) + c2[2]*ratio)

        draw.line([(0,y),(size,y)], fill=(r,g,b))

    # =========================
    # 🎨 パターン（円ランダム）
    # =========================
    for _ in range(6):
        x = random.randint(0, size)
        y = random.randint(0, size)
        r = random.randint(40, 120)

        overlay_color = random.choice(base_colors + fallback)

        draw.ellipse(
            (x-r, y-r, x+r, y+r),
            fill=(*overlay_color, 60)
        )

    # =========================
    # 🔤 TEXT（左上）
    # =========================
    try:
        font = ImageFont.truetype("arial.ttf", 56)
    except:
        font = ImageFont.load_default()

    # 長すぎる場合カット
    display_title = title[:20]

    text_w, text_h = draw.textbbox((0,0), display_title, font=font)[2:]

    padding = 20

    x = padding
    y = padding

    # シャドウ
    draw.text((x+2, y+2), display_title, font=font, fill=(0,0,0,180))

    # 本体
    draw.text((x, y), display_title, font=font, fill=(255,255,255))

    # =========================
    # 💾 R2保存
    # =========================
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)

    return upload_bytes_to_r2(buffer.read())


# =========================
# DELETE COVER
# =========================
def delete_cover_from_r2(key: str):
    try:
        r2.delete_object(
            Bucket=BUCKET,
            Key=key
        )
    except Exception as e:
        print("R2 delete failed:", e)




