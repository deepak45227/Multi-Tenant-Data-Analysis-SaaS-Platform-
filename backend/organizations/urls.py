
from django.urls import path
from .views import (
    CreateOrganizationView,
    ListOrganizationsView,
    ListMembersView,
    AddMemberView,
    UpdateMemberRoleView,
    DeleteMemberView,
    TransferOwnershipView,
    ListInvitesView,
    ResendInviteView,
    RevokeInviteView
)

urlpatterns = [
    path("create/", CreateOrganizationView.as_view(), name="create-organization"),
    path('', ListOrganizationsView.as_view(), name='list-organizations'),
    path("members/<int:org_id>/", ListMembersView.as_view(), name="list-members"),
    path("members/<int:org_id>/add-member/", AddMemberView.as_view(), name="add-member"),
    path("members/<int:membership_id>/update-role/", UpdateMemberRoleView.as_view(), name="update-member-role"),
    path("members/<int:membership_id>/delete/", DeleteMemberView.as_view(), name="delete-member"),
    path("invites/<int:org_id>/", ListInvitesView.as_view(), name="list-invites"),
    path("invites/<int:invite_id>/resend/", ResendInviteView.as_view(), name="resend-invite"),
    path("invites/<int:invite_id>/revoke/", RevokeInviteView.as_view(), name="revoke-invite"),
    path("transfer-ownership/<int:org_id>/", TransferOwnershipView.as_view(), name="transfer-ownership"),
    path("organizations/<int:org_id>/transfer-ownership/", TransferOwnershipView.as_view(), name="transfer-ownership-legacy"),
]
