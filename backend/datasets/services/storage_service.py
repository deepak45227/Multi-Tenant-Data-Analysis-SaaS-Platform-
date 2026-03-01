import os
import uuid
from django.conf import settings


class StorageService:

    @staticmethod
    def save_uploaded_file(file, organization_id):
        org_folder = os.path.join(settings.UPLOAD_ROOT, f"org_{organization_id}")
        os.makedirs(org_folder, exist_ok=True)

        unique_filename = f"{uuid.uuid4()}_{file.name}"
        file_path = os.path.join(org_folder, unique_filename)

        with open(file_path, "wb+") as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        return file_path
