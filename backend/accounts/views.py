from rest_framework.views import APIView
from rest_framework import  permissions
from rest_framework.response import Response 
from rest_framework import status 
from .serializers import RegisterSerializer

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self,request):
        serializer=RegisterSerializer(data=request.data)
       

        if serializer.is_valid():
            serializer.save()
            return Response({"message":"user created successfully"},status=status.HTTP_201_CREATED)
        return Response(serializer.errors,status=status.HTTP_400_BAD_REQUEST)
