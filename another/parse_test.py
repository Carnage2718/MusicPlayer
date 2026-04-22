import boto3
import re

ACCOUNT_ID = "b5c85d39f96ff83f554c1aedf278736f"
ACCESS_KEY = "61798cf7e8e0ea59f62d9cf8819f8022"
SECRET_KEY = "e6d0d1f3fffe2f27cce250161dcf8e62bb2e8d5476d0aee9bcb3fd6a3d5c76f8"
BUCKET_NAME = "musicplayer"

PUBLIC_BASE_URL = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com/{BUCKET_NAME}/"

r2 = boto3.client(
    service_name="s3",
    endpoint_url=f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name="auto",
)

def parse_filename(filename):
    name = filename.replace("converted_", "").replace(".m4a", "")
    artists_part, title_part = name.split(" - ", 1)

    main_artists = [a.strip() for a in artists_part.split(",")]

    ft_pattern = re.compile(r'\s+(ft\.|feat\.|featuring)\s+', re.IGNORECASE)
    match = ft_pattern.search(title_part)

    if match:
        title = ft_pattern.split(title_part)[0].strip()
        featuring_raw = title_part[match.end():]
        featuring_artists = [a.strip() for a in featuring_raw.split(",")]
    else:
        title = title_part.strip()
        featuring_artists = []

    return main_artists, title, featuring_artists

response = r2.list_objects_v2(Bucket=BUCKET_NAME)

count = 0

for obj in response.get("Contents", []):
    key = obj["Key"]

    if not key.endswith(".m4a"):
        continue

    main, title, ft = parse_filename(key)

    print("MAIN:", main)
    print("TITLE:", title)
    print("FT:", ft)
    print("URL:", PUBLIC_BASE_URL + key)
    print("-" * 40)

    count += 1
    if count == 30:
        break

print("確認完了")