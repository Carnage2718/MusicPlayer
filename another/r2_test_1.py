import boto3

R2_ACCOUNT_ID = "b5c85d39f96ff83f554c1aedf278736f"
R2_ACCESS_KEY = "61798cf7e8e0ea59f62d9cf8819f8022"
R2_SECRET_KEY = "e6d0d1f3fffe2f27cce250161dcf8e62bb2e8d5476d0aee9bcb3fd6a3d5c76f8"
R2_BUCKET_NAME = "musicplayer"

s3 = boto3.client(
    's3',
    endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name='auto'
)

with open("test.txt", "w") as f:
    f.write("R2接続テスト成功")

s3.upload_file("test.txt", R2_BUCKET_NAME, "test.txt")

print("アップロード成功")