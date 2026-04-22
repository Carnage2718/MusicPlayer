import os

R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL")

def build_cover_url(path: str | None):
    if not path:
        return None
    return f"{R2_PUBLIC_URL}/{path}"