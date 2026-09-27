from redis import Redis
from rq import Queue

from app.core.config import get_settings

_settings = get_settings()
_redis = Redis.from_url(_settings.redis_url)

investigation_queue = Queue("investigations", connection=_redis)
