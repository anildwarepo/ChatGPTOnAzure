import uuid
import azure.functions as func
import azure.durable_functions as df
import time
import json
from durable_orchestrators import orchestrator_bp
from durable_activities import activity_bp
from durable_entities import entities_bp



app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
app.register_functions(orchestrator_bp) # register the DF functions
app.register_functions(activity_bp) 
app.register_functions(entities_bp) 
