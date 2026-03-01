from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from rest_framework.generics import ListAPIView
from django.shortcuts import get_object_or_404

from .models import Organization, Membership
from .serializers import OrganizationSerializer, MembershipSerializer
from accounts.models import User
from .permissions import check_permission
from .models import Organization


class CreateOrganizationView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):

       serializer = OrganizationSerializer(data=request.data, context={'request': request})

       if serializer.is_valid():
            organization = serializer.save(owner=request.user)

            Membership.objects.create(
                user=request.user,
                organization=organization,
                role="admin" # default to admin
            )

            return Response(
                {
                    "message": "Organization created successfully",
                    "organization": OrganizationSerializer(organization).data,
                },
                status=status.HTTP_201_CREATED
            )

       return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ListOrganizationsView(ListAPIView):
    serializer_class=OrganizationSerializer
    permission_classes=[IsAuthenticated]

    def get_queryset(self):
        return Organization.objects.filter(
            memberships__user=self.request.user
        ).distinct()


class AddMemberView(APIView):
    permission_classes = [IsAuthenticated]
    

    def post(self, request, org_id):

        organization = get_object_or_404(Organization, id=org_id)

        # Only owner/admin can manage members
        check_permission(
            request.user,
            organization,
            "manage_members"
        )

        

        email = request.data.get("email")
        role = request.data.get("role")

        if role not in {"admin", "member"}:
            return Response({"error": "Role must be 'admin' or 'member'."}, status=400)

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({"error": "User with this email does not exist."}, status=404)

        if Membership.objects.filter(user=user, organization=organization).exists():
            return Response({"error": "User is already a member"}, status=400)

        membership = Membership.objects.create(
            user=user,
            organization=organization,
            role=role
        )

        return Response({"message": "Member added", "membership": MembershipSerializer(membership).data}, status=201)
    

class UpdateMemberRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, membership_id):
        membership = get_object_or_404(Membership, id=membership_id)

        check_permission(request.user, membership.organization, "manage_members")

        new_role = request.data.get("role")
        if new_role not in {"admin", "member"}:
            return Response({"error": "Role must be 'admin' or 'member'."}, status=400)

        # Do not allow owner's membership role to be changed from member APIs.
        if membership.user_id == membership.organization.owner_id:
            return Response(
                {"error": "Owner membership cannot be modified. Transfer ownership first."},
                status=400
            )

        membership.role = new_role
        membership.save()

        return Response({"message": "Role updated"})


class DeleteMemberView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, membership_id):
        membership = get_object_or_404(Membership, id=membership_id)

        check_permission(request.user, membership.organization, "manage_members")

        # Owner cannot be removed from membership management APIs.
        if membership.user_id == membership.organization.owner_id:
            return Response(
                {"error": "Owner cannot be removed. Transfer ownership first."},
                status=400
            )

        # Prevent a user from deleting their own membership accidentally.
        if membership.user_id == request.user.id:
            return Response(
                {"error": "You cannot delete your own membership."},
                status=400
            )

        membership.delete()
        return Response({"message": "Member removed"})


class ListMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, org_id):
        organization = get_object_or_404(Organization, id=org_id)
        check_permission(request.user, organization, "manage_members")
        memberships = Membership.objects.filter(organization=organization).select_related("user").order_by("id")
        return Response({"members": MembershipSerializer(memberships, many=True).data})

class TransferOwnershipView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, org_id):
        organization = Organization.objects.get(id=org_id)

        # Check if user can manage members at all
        check_permission(request.user, organization, "manage_members")

        # Only owner can transfer ownership
        current_membership = Membership.objects.get(
            user=request.user,
            organization=organization
        )

        if current_membership.role != "owner":
            return Response(
                {"error": "Only owner can transfer ownership"},
                status=403
            )

        new_owner_email = request.data.get("email")
        new_user = User.objects.get(email=new_owner_email)

        # Ensure new user is a member
        new_membership = Membership.objects.get(
            user=new_user,
            organization=organization
        )

        # Atomic update
        from django.db import transaction
        with transaction.atomic():
            current_membership.role = "admin"
            current_membership.save()

            new_membership.role = "owner"
            new_membership.save()

        return Response({"message": "Ownership transferred"})
