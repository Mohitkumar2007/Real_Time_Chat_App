from rest_framework.exceptions import AuthenticationFailed, NotFound, PermissionDenied, ValidationError

from .repositories import ContactRepository, MessageRepository, TypingRepository, UserRepository, normalize_user_id
from .totp import generate_totp_secret, totp_uri, verify_totp


class ChatService:
    def __init__(self):
        self.users = UserRepository()
        self.contacts = ContactRepository()
        self.messages = MessageRepository()
        self.typing = TypingRepository()

    def setup_totp(self, payload):
        user_id = normalize_user_id(payload["user_id"])
        if self.users.get_by_user_id(user_id):
            raise ValidationError({"user_id": "This username is already taken."})
        secret = generate_totp_secret()
        return {"secret": secret, "otpauth_uri": totp_uri(user_id, secret)}

    def register(self, payload):
        if not verify_totp(payload["totp_secret"], payload["totp_code"]):
            raise ValidationError({"totp_code": "Authenticator code is invalid or expired."})
        try:
            user = self.users.create(payload)
        except ValueError as exc:
            raise ValidationError({"user_id": str(exc)}) from exc
        return self._public_user(user)

    def login(self, payload):
        user = self.users.authenticate(payload["user_id"], payload["password"])
        if not user or not verify_totp(user.get("totp_secret", ""), payload["totp_code"]):
            raise AuthenticationFailed("Invalid username, password, or authenticator code.")
        return self._public_user(user)

    def authenticate_request(self, request):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else None
        user = self.users.get_by_token(token)
        if not user:
            raise AuthenticationFailed("Login required.")
        return user

    def list_contacts(self, current_user, search: str | None = None):
        return self.contacts.list(current_user["user_id"], search=search)

    def update_profile(self, current_user, payload):
        updates = {}
        if "display_name" in payload:
            display_name = payload["display_name"].strip()
            if not display_name:
                raise ValidationError({"display_name": "Please enter a display name."})
            updates["display_name"] = display_name
        if "avatar" in payload:
            updates["avatar"] = payload["avatar"]
        if not updates:
            raise ValidationError({"display_name": "Update at least one profile field."})
        user = self.users.update_profile(current_user, updates)
        self.contacts.update_contact_profile(current_user["user_id"], updates)
        return self._public_user(user)

    def change_password(self, current_user, payload):
        if payload["current_password"] == payload["new_password"]:
            raise ValidationError({"new_password": "Choose a new password that is different from your current password."})
        changed = self.users.update_password(current_user, payload["current_password"], payload["new_password"])
        if not changed:
            raise ValidationError({"current_password": "Current password is incorrect."})
        return {"message": "Password changed successfully."}

    def create_contact(self, current_user, payload):
        contact_user_id = normalize_user_id(payload["user_id"])
        if contact_user_id == current_user["user_id"]:
            raise PermissionDenied("You cannot add yourself as a contact.")
        contact_user = self.users.get_by_user_id(contact_user_id)
        if not contact_user:
            raise NotFound("User ID not found.")
        return self.contacts.create(current_user["user_id"], contact_user)

    def list_messages(self, current_user, contact_user_id: str):
        contact_user = self.users.get_by_user_id(contact_user_id)
        if not contact_user:
            raise NotFound("Contact not found.")
        if not self.contacts.get(current_user["user_id"], contact_user["user_id"]):
            raise PermissionDenied("Add this user as a contact before opening the chat.")
        self.messages.mark_read_for_recipient(
            current_user["user_id"],
            contact_user["user_id"],
            current_user["user_id"],
        )
        return self.messages.list_for_conversation(current_user["user_id"], contact_user["user_id"])

    def create_message(self, current_user, contact_user_id: str, payload):
        contact_user = self.users.get_by_user_id(contact_user_id)
        if not contact_user:
            raise NotFound("Contact not found.")
        self.contacts.create(current_user["user_id"], contact_user)
        self.contacts.create(contact_user["user_id"], current_user)
        message = self.messages.create(current_user["user_id"], contact_user["user_id"], payload)
        self.typing.set_status(current_user["user_id"], contact_user["user_id"], False)
        last_message = message["text"] or ("GIF" if message.get("attachment_type") == "gif" else "Image")
        self.contacts.update_last_message(current_user["user_id"], contact_user["user_id"], last_message, message["created_at"])
        self.contacts.update_last_message(contact_user["user_id"], current_user["user_id"], last_message, message["created_at"])
        return message

    def set_typing_status(self, current_user, contact_user_id: str, payload):
        contact_user = self.users.get_by_user_id(contact_user_id)
        if not contact_user:
            raise NotFound("Contact not found.")
        self.typing.set_status(current_user["user_id"], contact_user["user_id"], payload["is_typing"])
        return {"is_typing": payload["is_typing"]}

    def get_typing_status(self, current_user, contact_user_id: str):
        contact_user = self.users.get_by_user_id(contact_user_id)
        if not contact_user:
            raise NotFound("Contact not found.")
        return {"is_typing": self.typing.is_typing(contact_user["user_id"], current_user["user_id"])}

    def _public_user(self, user):
        return {
            "id": user["id"],
            "user_id": user["user_id"],
            "display_name": user["display_name"],
            "avatar": user["avatar"],
            "token": user["auth_token"],
        }
