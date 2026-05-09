from django.urls import path

from .views import (
    ContactListCreateAPIView,
    LoginAPIView,
    MessageListCreateAPIView,
    PasswordChangeAPIView,
    ProfileAPIView,
    RegisterAPIView,
    TotpSetupAPIView,
    TypingStatusAPIView,
)

urlpatterns = [
    path("auth/totp/setup/", TotpSetupAPIView.as_view(), name="totp-setup"),
    path("auth/register/", RegisterAPIView.as_view(), name="register"),
    path("auth/login/", LoginAPIView.as_view(), name="login"),
    path("auth/profile/", ProfileAPIView.as_view(), name="profile"),
    path("auth/password/", PasswordChangeAPIView.as_view(), name="password-change"),
    path("contacts/", ContactListCreateAPIView.as_view(), name="contact-list-create"),
    path("contacts/<str:contact_user_id>/messages/", MessageListCreateAPIView.as_view(), name="message-list-create"),
    path("contacts/<str:contact_user_id>/typing/", TypingStatusAPIView.as_view(), name="typing-status"),
]
