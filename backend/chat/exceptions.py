from typing import Any

from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _first_message(detail: Any) -> str:
    if isinstance(detail, list):
        return _first_message(detail[0]) if detail else "Please check the submitted information."
    if isinstance(detail, dict):
        if "message" in detail:
            return _first_message(detail["message"])
        if "detail" in detail:
            return _first_message(detail["detail"])
        for field, value in detail.items():
            message = _first_message(value)
            field_name = str(field).replace("_", " ")
            return f"{field_name.capitalize()}: {message}"
        return "Please check the submitted information."
    return str(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, (ServerSelectionTimeoutError, PyMongoError)):
        return Response(
            {"message": "The chat database is unavailable. Please make sure MongoDB is running."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    response = exception_handler(exc, context)
    if response is None:
        return response

    response.data = {"message": _first_message(response.data)}
    return response
