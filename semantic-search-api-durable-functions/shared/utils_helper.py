import pandas as pd
import uuid
import datetime
from azure.storage.blob import BlobServiceClient
import os

def format_response(openai_response, sources, usage):
#def format_response(LLM_Response openai_response, sources):
    if sources:
        df = pd.DataFrame(sources)
        arr_unique_filename = df['fileName'].unique()
        citations = ""
        for filename in arr_unique_filename:
            page_numbers = df.loc[df['fileName'] == filename]
            citations += f"\n{filename}, page numbers:"
            for page in page_numbers['pageNumber']:
                citations += f"[{page}]\n"      
        
        openai_response += f"\n\n\nCitations: \n{citations}"

    #return LLM_Response(openai_response, usage)
    return { "llm_response" : openai_response, "usage" : usage }

def createlog(prompt, response):
    #create guid
    new_uuid = str(uuid.uuid4())
    timestamp = datetime.datetime.utcnow()
    
    log = { "id": new_uuid, "utcTimeStamp": str(timestamp),  "conversationId" : new_uuid, "prompt" : prompt['gptPrompt'], "userInfo": prompt['userInfo'], "response" : response }
    return log


def upload_file(file):
    
    connection_string = os.environ["AzureWebJobsStorage"]
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_name = "fileuploads"
    container_client = blob_service_client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(file.filename)
    blob_client.upload_blob(file, overwrite=True)
    return {"api": "chatapi_status", "method": "GET", "status": "success", "chatHistory": None, "message": f"{file.filename} - File uploaded successfully"}
    
   