from functools import lru_cache

from django.conf import settings
from pymongo import MongoClient


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    return MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=3000)


def get_database():
    return get_mongo_client()[settings.MONGO_DB_NAME]
