from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AuthenticatedUserSerializer,
    ContactSerializer,
    LoginSerializer,
    MessageSerializer,
    PasswordChangeSerializer,
    ProfileUpdateSerializer,
    TotpSetupResponseSerializer,
    TotpSetupSerializer,
    UserSerializer,
)
from .services import ChatService


class RegisterAPIView(APIView):
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = ChatService().register(serializer.validated_data)
        return Response(AuthenticatedUserSerializer(user).data, status=status.HTTP_201_CREATED)


class TotpSetupAPIView(APIView):
    def post(self, request):
        serializer = TotpSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        setup = ChatService().setup_totp(serializer.validated_data)
        return Response(TotpSetupResponseSerializer(setup).data)


class LoginAPIView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = ChatService().login(serializer.validated_data)
        return Response(AuthenticatedUserSerializer(user).data)


class ProfileAPIView(APIView):
    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ChatService()
        current_user = service.authenticate_request(request)
        user = service.update_profile(current_user, serializer.validated_data)
        return Response(AuthenticatedUserSerializer(user).data)


class PasswordChangeAPIView(APIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ChatService()
        current_user = service.authenticate_request(request)
        result = service.change_password(current_user, serializer.validated_data)
        return Response(result)


class ContactListCreateAPIView(APIView):
    def get(self, request):
        service = ChatService()
        current_user = service.authenticate_request(request)
        contacts = service.list_contacts(current_user, search=request.query_params.get("search"))
        return Response(ContactSerializer(contacts, many=True).data)

    def post(self, request):
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ChatService()
        current_user = service.authenticate_request(request)
        contact = service.create_contact(current_user, serializer.validated_data)
        return Response(ContactSerializer(contact).data, status=status.HTTP_201_CREATED)


class MessageListCreateAPIView(APIView):
    def get(self, request, contact_user_id: str):
        service = ChatService()
        current_user = service.authenticate_request(request)
        messages = service.list_messages(current_user, contact_user_id)
        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, contact_user_id: str):
        serializer = MessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = ChatService()
        current_user = service.authenticate_request(request)
        message = service.create_message(current_user, contact_user_id, serializer.validated_data)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

# Create your views here.
