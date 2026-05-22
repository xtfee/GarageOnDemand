from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False) 
    phone_number = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'is_active', 'phone_number')
        read_only_fields = ('id',)

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        role = validated_data.get('role', 'client')
        
        if not password:
            raise serializers.ValidationError({"password": "This field is required when creating a user."})

        
        is_staff = True if role == 'admin' else False

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data['phone_number'],
            is_staff=is_staff  
        )

        user.role = role
        user.is_active = validated_data.get('is_active', True)
        
        if role == 'admin':
            user.email_verified = True 
            
        user.save()
        return user

    def update(self, instance, validated_data):
        # role/is_staff are intentionally NOT updated here — prevents privilege escalation
        # through the public profile endpoint. Admins manage roles in Django admin.
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()
        return instance

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value