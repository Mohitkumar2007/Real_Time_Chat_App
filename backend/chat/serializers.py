from rest_framework import serializers


def validate_strong_password(value: str) -> str:
    if len(value) < 8:
        raise serializers.ValidationError("Password must be at least 8 characters.")
    if not any(char.isupper() for char in value):
        raise serializers.ValidationError("Password must include at least one capital letter.")
    if not any(char.isdigit() for char in value):
        raise serializers.ValidationError("Password must include at least one digit.")
    if not any(not char.isalnum() for char in value):
        raise serializers.ValidationError("Password must include at least one special character.")
    return value


class TotpSetupSerializer(serializers.Serializer):
    user_id = serializers.RegexField(
        regex=r"^[A-Za-z0-9_.-]{3,32}$",
        max_length=32,
        error_messages={
            "invalid": "Use 3-32 letters, numbers, dots, underscores, or hyphens.",
            "blank": "Please enter a username.",
            "required": "Please enter a username.",
        },
    )


class TotpSetupResponseSerializer(serializers.Serializer):
    secret = serializers.CharField(read_only=True)
    otpauth_uri = serializers.CharField(read_only=True)


class UserSerializer(serializers.Serializer):
    user_id = serializers.RegexField(
        regex=r"^[A-Za-z0-9_.-]{3,32}$",
        max_length=32,
        error_messages={
            "invalid": "Use 3-32 letters, numbers, dots, underscores, or hyphens.",
            "blank": "Please enter a username.",
            "required": "Please enter a username.",
        },
    )
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    password = serializers.CharField(
        min_length=8,
        max_length=128,
        write_only=True,
        validators=[validate_strong_password],
        error_messages={
            "min_length": "Password must be at least 8 characters.",
            "blank": "Please enter a password.",
            "required": "Please enter a password.",
        },
    )
    totp_secret = serializers.CharField(write_only=True)
    totp_code = serializers.RegexField(
        regex=r"^\d{6}$",
        write_only=True,
        error_messages={
            "invalid": "Enter the 6-digit code from your authenticator app.",
            "blank": "Enter the 6-digit code from your authenticator app.",
            "required": "Enter the 6-digit code from your authenticator app.",
        },
    )


class LoginSerializer(serializers.Serializer):
    user_id = serializers.CharField(max_length=32, error_messages={"blank": "Please enter your username."})
    password = serializers.CharField(max_length=128, write_only=True, error_messages={"blank": "Please enter your password."})
    totp_code = serializers.RegexField(
        regex=r"^\d{6}$",
        write_only=True,
        error_messages={
            "invalid": "Enter the 6-digit code from your authenticator app.",
            "blank": "Enter the 6-digit code from your authenticator app.",
            "required": "Enter the 6-digit code from your authenticator app.",
        },
    )


class AuthenticatedUserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    user_id = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    avatar = serializers.CharField(read_only=True)
    token = serializers.CharField(read_only=True)


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(
        max_length=120,
        required=False,
        error_messages={
            "blank": "Please enter a display name.",
            "max_length": "Display name is too long.",
        },
    )
    avatar = serializers.CharField(required=False, allow_blank=True, max_length=750000)

    def validate_avatar(self, value):
        if value and not value.startswith("data:image/"):
            raise serializers.ValidationError("Please upload a valid image file.")
        return value


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        max_length=128,
        write_only=True,
        error_messages={
            "blank": "Please enter your current password.",
            "required": "Please enter your current password.",
        },
    )
    new_password = serializers.CharField(
        min_length=8,
        max_length=128,
        write_only=True,
        validators=[validate_strong_password],
        error_messages={
            "min_length": "New password must be at least 8 characters.",
            "blank": "Please enter a new password.",
            "required": "Please enter a new password.",
        },
    )


class ContactSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    user_id = serializers.CharField(max_length=32, error_messages={"blank": "Please enter a user ID."})
    display_name = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=120, read_only=True)
    avatar = serializers.CharField(read_only=True)
    online = serializers.BooleanField(read_only=True)
    last_message = serializers.CharField(read_only=True, required=False)
    last_message_at = serializers.CharField(read_only=True, required=False)
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)


class MessageSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    conversation_id = serializers.CharField(read_only=True)
    text = serializers.CharField(
        max_length=2000,
        error_messages={
            "blank": "Please enter a message.",
            "max_length": "Message is too long.",
            "required": "Please enter a message.",
        },
    )
    sender_user_id = serializers.CharField(read_only=True)
    recipient_user_id = serializers.CharField(read_only=True)
    status = serializers.ChoiceField(choices=["sent", "delivered", "read"], default="sent")
    created_at = serializers.CharField(read_only=True)
