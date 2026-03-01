from django.urls import path
from datasets.views import (DatasetUploadView , DatasetPreviewView, StartEditingSessionView, DatasetListView 
                            , AddEditingStepView,SessionPreviewView, UndoEditingStepView,ApplyEditingSessionView
                            , RollbackView, )

urlpatterns = [
    path("upload/", DatasetUploadView.as_view(), name="dataset-upload"),
    path("list/", DatasetListView.as_view()),
     path("preview/<uuid:version_id>/", DatasetPreviewView.as_view()),

    path("edit/start/<uuid:dataset_id>/", StartEditingSessionView.as_view()),
    path("edit/add-step/<uuid:session_id>/", AddEditingStepView.as_view()),
    path("edit/preview/<uuid:session_id>/", SessionPreviewView.as_view()),
    path("edit/undo/<uuid:session_id>/", UndoEditingStepView.as_view()),
    path("edit/apply/<uuid:session_id>/",ApplyEditingSessionView.as_view(), name="apply-editing-session"),
    path("rollback/<uuid:dataset_id>/<uuid:version_id>/", RollbackView.as_view(), name="version-rollback"),
    # path("activate-base/<uuid:dataset_id>/", ActivateBaseView.as_view(), name="activate-base"),

]
