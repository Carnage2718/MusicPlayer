import os
import boto3
from dotenv import load_dotenv

load_dotenv()

R2_ENDPOINT = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.getenv("R2_BUCKET")

r2 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY
)

deleted = 0
continuation_token = None

while True:

    if continuation_token:
        response = r2.list_objects_v2(
            Bucket=R2_BUCKET,
            ContinuationToken=continuation_token
        )
    else:
        response = r2.list_objects_v2(
            Bucket=R2_BUCKET
        )

    contents = response.get("Contents", [])

    if not contents:
        break

    objects = [{"Key": obj["Key"]} for obj in contents]

    r2.delete_objects(
        Bucket=R2_BUCKET,
        Delete={"Objects": objects}
    )

    deleted += len(objects)

    print(f"deleted {deleted}")

    if response.get("IsTruncated"):
        continuation_token = response["NextContinuationToken"]
    else:
        break

print("All objects deleted:", deleted)