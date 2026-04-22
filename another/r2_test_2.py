import boto3

r2 = boto3.client(
    service_name='s3',
    endpoint_url='https://b5c85d39f96ff83f554c1aedf278736f.r2.cloudflarestorage.com',
    aws_access_key_id='61798cf7e8e0ea59f62d9cf8819f8022',
    aws_secret_access_key='e6d0d1f3fffe2f27cce250161dcf8e62bb2e8d5476d0aee9bcb3fd6a3d5c76f8',
    region_name='auto'
)

response = r2.list_objects_v2(Bucket='musicplayer')

for obj in response.get('Contents', []):
    print(obj['Key'], obj['ETag'])