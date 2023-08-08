import azure.functions as func
import azure.durable_functions as df
import uuid
import json
import base64
from shared.utils_helper import upload_file


orchestrator_bp = df.Blueprint()


# An HTTP-Triggered Function with a Durable Functions Client binding
@orchestrator_bp.route(route="orchestrators/{functionName}/{activityName}")
@orchestrator_bp.durable_client_input(client_name="client")
async def http_start(req: func.HttpRequest, client) -> func.HttpResponse:
    function_name = req.route_params.get('functionName')
    activityName = req.route_params.get('activityName')
    instance_id = await client.start_new(function_name, None, get_activity_parameters(req, activityName))
    response = await client.wait_for_completion_or_create_check_status_response(req, instance_id, 100000, 1000)
    return response

@orchestrator_bp.route(route="file_upload")
@orchestrator_bp.durable_client_input(client_name="client")
async def file_upload(req: func.HttpRequest, client) -> func.HttpResponse:
    entityId = df.EntityId("entity_function", uuid.uuid4())
    file_data = req.files["file"].read()
    base64_encoded = base64.b64encode(file_data).decode('utf-8')
    await client.signal_entity(entityId, "upload_file", {"fileName" : req.files["file"].filename, "fileData" : base64_encoded} )
    return func.HttpResponse(json.dumps({"entityId": str(entityId.key)}))


@orchestrator_bp.route(route="file_upload_progress/{prevEntityId}")
@orchestrator_bp.durable_client_input(client_name="client")
async def get_progress(req: func.HttpRequest, client, context) -> func.HttpResponse:
    prevEntityId = req.route_params.get('prevEntityId')
    entityId = df.EntityId("entity_function", prevEntityId)
    entity_state_result = await client.read_entity_state(entityId)
    entity_state = "Uploading..."
    if entity_state_result.entity_exists:
      entity_state = str(entity_state_result.entity_state)
    #return func.HttpResponse(entity_state)
    return func.HttpResponse(json.dumps({"entity_state": entity_state}))
   

# Orchestrator
@orchestrator_bp.orchestration_trigger(context_name="context")
def chatbot_orchestrator(context):
    activity_input = context.get_input()
    result = yield context.call_activity(activity_input['activityName'], activity_input)
    return result



def get_activity_parameters(req: func.HttpRequest, activityName: str):
    if req.method == "POST":
        if len(req.files) > 0:
            return {"activityName": activityName, "data": {}, "file": req.files["file"]}
        else:
            return {"activityName": activityName, "data": req.get_json()}            
    elif req.method == "GET":
        query_params = {key: value for key, value in req.params.items()}
        return {"activityName": activityName, "data": query_params}




