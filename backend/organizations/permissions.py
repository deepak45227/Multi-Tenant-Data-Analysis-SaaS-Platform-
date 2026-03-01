ROLE_PERMISSIONS = {
    # "owner": {
    #     "manage_datasets": True,
    #     "run_queries": True,
    #     "create_charts": True,
    #     "manage_dashboards": True,
    #     "view_reports": True,
    #     "send_reports": True,
    #     "manage_members": True,
    # },
    "admin": {
        "manage_datasets": True,
        "run_queries": True,
        "create_charts": True,
        "manage_dashboards": True,
        "view_reports": True,
        "send_reports": True,
        "manage_members": True,
    },
    "member": {
        "manage_datasets": False,
        "run_queries": False,
        "create_charts": False,
        "manage_dashboards": False,
        "view_reports": True,
        "send_reports": False,
        "manage_members": False,
    },
}


from .models import Membership

def check_permission(user, organization, permission_key):
    
    if organization.owner_id == user.id:
        return True

    try:
        membership = Membership.objects.get(
            user=user,
            organization=organization
        )
    except Membership.DoesNotExist:
        raise PermissionError("User not in organization")

    role = membership.role
    permissions = ROLE_PERMISSIONS.get(role, {})
    
    
    if not permissions.get(permission_key, False):
        raise PermissionError("Permission denied")
       
    
   
