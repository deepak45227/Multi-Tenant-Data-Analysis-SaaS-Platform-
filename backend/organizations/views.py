import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from rest_framework.generics import ListAPIView
from django.shortcuts import get_object_or_404
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

from .models import Organization, Membership, OrganizationInvite
from .serializers import OrganizationSerializer, MembershipSerializer, OrganizationInviteSerializer
from accounts.models import User
from .permissions import check_permission
from .emails import send_invite_email, send_member_added_email


def _invite_expiry():
    days = getattr(settings, "INVITE_EXPIRY_DAYS", 7)
    return timezone.now() + timedelta(days=days)


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

        

        email = (request.data.get("email") or "").strip().lower()
        role = (request.data.get("role") or "member").strip().lower()

        if not email:
            return Response({"error": "Email is required."}, status=400)

        try:
            validate_email(email)
        except ValidationError:
            return Response({"error": "Invalid email address."}, status=400)

        if role not in {"admin", "member"}:
            return Response({"error": "Role must be 'admin' or 'member'."}, status=400)

        user = User.objects.filter(email__iexact=email).first()
        if user:
            if Membership.objects.filter(user=user, organization=organization).exists():
                return Response({"error": "User is already a member"}, status=400)

            membership = Membership.objects.create(
                user=user,
                organization=organization,
                role=role
            )
            send_member_added_email(user, organization)
            return Response(
                {
                    "message": "Member added",
                    "invited": False,
                    "membership": MembershipSerializer(membership).data
                },
                status=201
            )

        invite = OrganizationInvite.objects.filter(
            organization=organization,
            email__iexact=email,
            accepted_at__isnull=True
        ).first()

        if invite and not invite.is_expired():
            invite.role = role
            invite.expires_at = _invite_expiry()
            invite.invited_by = request.user
            invite.token = uuid.uuid4()
            invite.save(update_fields=["role", "expires_at", "invited_by", "token"])
        else:
            if invite:
                invite.delete()
            invite = OrganizationInvite.objects.create(
                organization=organization,
                email=email,
                role=role,
                invited_by=request.user,
                expires_at=_invite_expiry()
            )

        send_invite_email(invite)
        return Response(
            {
                "message": "Invite sent",
                "invited": True,
                "invite": OrganizationInviteSerializer(invite).data
            },
            status=201
        )
    

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


class ListInvitesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, org_id):
        organization = get_object_or_404(Organization, id=org_id)
        check_permission(request.user, organization, "manage_members")
        invites = OrganizationInvite.objects.filter(
            organization=organization,
            accepted_at__isnull=True
        ).order_by("-created_at")
        return Response({"invites": OrganizationInviteSerializer(invites, many=True).data})


class ResendInviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, invite_id):
        invite = get_object_or_404(OrganizationInvite, id=invite_id, accepted_at__isnull=True)
        check_permission(request.user, invite.organization, "manage_members")
        invite.token = uuid.uuid4()
        invite.expires_at = _invite_expiry()
        invite.invited_by = request.user
        invite.save(update_fields=["token", "expires_at", "invited_by"])
        send_invite_email(invite)
        return Response({"message": "Invite resent", "invite": OrganizationInviteSerializer(invite).data})


class RevokeInviteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, invite_id):
        invite = get_object_or_404(OrganizationInvite, id=invite_id, accepted_at__isnull=True)
        check_permission(request.user, invite.organization, "manage_members")
        invite.delete()
        return Response({"message": "Invite revoked"})


class TransferOwnershipView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, org_id):
        organization = Organization.objects.get(id=org_id)
        check_permission(request.user, organization, "manage_members")

        if request.user.id != organization.owner_id:
            return Response({"error": "Only the current owner can transfer ownership."}, status=403)

        new_owner_email = (request.data.get("email") or "").strip().lower()
        if not new_owner_email:
            return Response({"error": "New owner email is required."}, status=400)

        new_user = User.objects.filter(email__iexact=new_owner_email).first()
        if not new_user:
            return Response({"error": "User with this email does not exist."}, status=404)

        if new_user.id == organization.owner_id:
            return Response({"error": "User is already the owner."}, status=400)

        Membership.objects.get_or_create(
            user=new_user,
            organization=organization,
            defaults={"role": "admin"},
        )

        with transaction.atomic():
            organization.owner = new_user
            organization.save(update_fields=["owner"])

        return Response({"message": "Ownership transferred"})
