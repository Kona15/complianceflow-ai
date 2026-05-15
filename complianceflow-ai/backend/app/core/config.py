from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str

    # Kimi API
    kimi_api_key: str
    kimi_base_url: str = "https://api.moonshot.cn/v1"

    # SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None

    # App
    app_env: str = "development"
    app_port: int = 8000
    log_level: str = "INFO"

    # Security
    secret_key: str
    access_token_expire_minutes: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()
