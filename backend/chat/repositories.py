from datetime import datetime, timedelta, timezone
import secrets
from typing import Any

from bson import ObjectId
from django.contrib.auth.hashers import check_password, make_password
from pymongo.errors import DuplicateKeyError

from .db import get_database


def serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    document["id"] = str(document.pop("_id"))
    return document


def normalize_user_id(user_id: str) -> str:
    return user_id.strip().lower()


def conversation_id_for(first_user_id: str, second_user_id: str) -> str:
    return "::".join(sorted([normalize_user_id(first_user_id), normalize_user_id(second_user_id)]))


class UserRepository:
    collection_name = "users"

    def __init__(self):
        self.collection = get_database()[self.collection_name]
        self.collection.create_index("user_id", unique=True)
        self.collection.create_index("auth_token", sparse=True)

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        user_id = normalize_user_id(payload["user_id"])
        display_name = payload.get("display_name") or user_id
        document = {
            "user_id": user_id,
            "display_name": display_name,
            "password_hash": make_password(payload["password"]),
            "totp_secret": payload["totp_secret"],
            "avatar": f"https://i.pravatar.cc/150?u={user_id}",
            "auth_token": secrets.token_urlsafe(32),
            "created_at": now,
            "updated_at": now,
        }
        try:
            result = self.collection.insert_one(document)
        except DuplicateKeyError as exc:
            raise ValueError("This user ID is already taken.") from exc
        document["_id"] = result.inserted_id
        return serialize_document(document)

    def authenticate(self, user_id: str, password: str) -> dict[str, Any] | None:
        user = self.get_by_user_id(user_id)
        if not user or not check_password(password, user["password_hash"]):
            return None
        token = secrets.token_urlsafe(32)
        self.collection.update_one({"_id": ObjectId(user["id"])}, {"$set": {"auth_token": token}})
        user["auth_token"] = token
        return user

    def update_profile(self, user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        updates = {"updated_at": now}
        if "display_name" in payload:
            updates["display_name"] = payload["display_name"]
        if "avatar" in payload:
            updates["avatar"] = payload["avatar"]
        self.collection.update_one(
            {"_id": ObjectId(user["id"])},
            {"$set": updates},
        )
        updated_user = {**user, **updates}
        return updated_user

    def update_password(self, user: dict[str, Any], current_password: str, new_password: str) -> bool:
        if not check_password(current_password, user["password_hash"]):
            return False
        now = datetime.now(timezone.utc).isoformat()
        self.collection.update_one(
            {"_id": ObjectId(user["id"])},
            {"$set": {"password_hash": make_password(new_password), "updated_at": now}},
        )
        return True

    def get_by_user_id(self, user_id: str) -> dict[str, Any] | None:
        user = self.collection.find_one({"user_id": normalize_user_id(user_id)})
        return serialize_document(user) if user else None

    def get_by_token(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        user = self.collection.find_one({"auth_token": token})
        return serialize_document(user) if user else None

    def clear_all(self) -> None:
        self.collection.delete_many({})


class ContactRepository:
    collection_name = "contacts"

    def __init__(self):
        self.collection = get_database()[self.collection_name]
        self.collection.create_index([("owner_user_id", 1), ("contact_user_id", 1)], unique=True)

    def list(self, owner_user_id: str, search: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"owner_user_id": normalize_user_id(owner_user_id)}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"contact_user_id": {"$regex": search, "$options": "i"}},
            ]
        contacts = self.collection.find(query).sort("name", 1)
        return [serialize_document(contact) for contact in contacts]

    def get(self, owner_user_id: str, contact_user_id: str) -> dict[str, Any] | None:
        contact = self.collection.find_one(
            {"owner_user_id": normalize_user_id(owner_user_id), "contact_user_id": normalize_user_id(contact_user_id)}
        )
        return serialize_document(contact) if contact else None

    def create(self, owner_user_id: str, contact_user: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        document = {
            "owner_user_id": normalize_user_id(owner_user_id),
            "contact_user_id": contact_user["user_id"],
            "user_id": contact_user["user_id"],
            "display_name": contact_user["display_name"],
            "name": contact_user["display_name"],
            "avatar": contact_user["avatar"],
            "online": True,
            "created_at": now,
            "updated_at": now,
        }
        existing = self.get(owner_user_id, contact_user["user_id"])
        if existing:
            return existing
        try:
            result = self.collection.insert_one(document)
            document["_id"] = result.inserted_id
        except DuplicateKeyError:
            return self.get(owner_user_id, contact_user["user_id"])
        return serialize_document(document)

    def update_last_message(self, owner_user_id: str, contact_user_id: str, text: str, timestamp: str) -> None:
        self.collection.update_one(
            {"owner_user_id": normalize_user_id(owner_user_id), "contact_user_id": normalize_user_id(contact_user_id)},
            {"$set": {"last_message": text, "last_message_at": timestamp, "updated_at": timestamp}},
        )

    def update_contact_profile(self, contact_user_id: str, payload: dict[str, Any]) -> None:
        updates: dict[str, Any] = {}
        if "display_name" in payload:
            updates["display_name"] = payload["display_name"]
            updates["name"] = payload["display_name"]
        if "avatar" in payload:
            updates["avatar"] = payload["avatar"]
        if not updates:
            return
        self.collection.update_many(
            {"contact_user_id": normalize_user_id(contact_user_id)},
            {"$set": updates},
        )

    def clear_all(self) -> None:
        self.collection.delete_many({})


class MessageRepository:
    collection_name = "messages"

    def __init__(self):
        self.collection = get_database()[self.collection_name]
        self.collection.create_index([("conversation_id", 1), ("created_at", 1)])

    def list_for_conversation(self, first_user_id: str, second_user_id: str) -> list[dict[str, Any]]:
        messages = self.collection.find(
            {"conversation_id": conversation_id_for(first_user_id, second_user_id)}
        ).sort("created_at", 1)
        return [serialize_document(message) for message in messages]

    def mark_read_for_recipient(self, first_user_id: str, second_user_id: str, recipient_user_id: str) -> None:
        self.collection.update_many(
            {
                "conversation_id": conversation_id_for(first_user_id, second_user_id),
                "recipient_user_id": normalize_user_id(recipient_user_id),
                "status": {"$ne": "read"},
            },
            {"$set": {"status": "read"}},
        )

    def create(self, sender_user_id: str, recipient_user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        document = {
            "conversation_id": conversation_id_for(sender_user_id, recipient_user_id),
            "text": payload.get("text", ""),
            "sender_user_id": normalize_user_id(sender_user_id),
            "recipient_user_id": normalize_user_id(recipient_user_id),
            "status": "sent",
            "created_at": now,
        }
        if payload.get("attachment_url"):
            document["attachment_url"] = payload["attachment_url"]
            document["attachment_type"] = payload.get("attachment_type", "image")
            document["attachment_name"] = payload.get("attachment_name", "")
        result = self.collection.insert_one(document)
        document["_id"] = result.inserted_id
        return serialize_document(document)

    def clear_all(self) -> None:
        self.collection.delete_many({})


class TypingRepository:
    collection_name = "typing_status"

    def __init__(self):
        self.collection = get_database()[self.collection_name]
        self.collection.create_index([("conversation_id", 1), ("sender_user_id", 1)], unique=True)

    def set_status(self, sender_user_id: str, recipient_user_id: str, is_typing: bool) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.collection.update_one(
            {
                "conversation_id": conversation_id_for(sender_user_id, recipient_user_id),
                "sender_user_id": normalize_user_id(sender_user_id),
            },
            {
                "$set": {
                    "conversation_id": conversation_id_for(sender_user_id, recipient_user_id),
                    "sender_user_id": normalize_user_id(sender_user_id),
                    "recipient_user_id": normalize_user_id(recipient_user_id),
                    "is_typing": is_typing,
                    "updated_at": now,
                }
            },
            upsert=True,
        )

    def is_typing(self, sender_user_id: str, recipient_user_id: str) -> bool:
        status = self.collection.find_one(
            {
                "conversation_id": conversation_id_for(sender_user_id, recipient_user_id),
                "sender_user_id": normalize_user_id(sender_user_id),
                "recipient_user_id": normalize_user_id(recipient_user_id),
                "is_typing": True,
            }
        )
        if not status:
            return False
        updated_at = datetime.fromisoformat(status["updated_at"])
        return updated_at >= datetime.now(timezone.utc) - timedelta(seconds=6)

    def clear_all(self) -> None:
        self.collection.delete_many({})
