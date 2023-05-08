import datetime
import logging
import json
import azure.functions as func
from sys import path
from shared import openai_helper
import uuid



def main(req: func.HttpRequest, chatHistory: func.DocumentList, documents: func.Out[func.Document]) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')


    if req.method == "GET":
        logging.info('Python HTTP trigger function processed a request.')
        if not chatHistory:
            return func.HttpResponse(json.dumps({"api": "chatapi", "method": "GET", "status": "success", "chatHistory": None, "message": "no chat history found"}))
        else:
            chat_history_json = [doc.to_json() for doc in chatHistory]
            return func.HttpResponse(json.dumps({"api": "chatapi", "method": "GET", "status": "success", "chatHistory": chat_history_json}))
    

    if req.method == "POST":
        logging.info('Python HTTP trigger function processed a request.')
        #deployment_name = req.route_params.get('deployment_name')
        api_version = req.params.get('api-version')
        prompt = req.get_json()
        #prompt = {userQuery: userQuery, maxTokens: max_tokens, temperature: temperature, systemMessage: systemMessage}
        openai_response = openai_helper.call_openai(prompt)
        log = createlog(prompt, openai_response)
        documents.set(func.Document.from_json(json.dumps(log)))
        return func.HttpResponse(json.dumps({"api": "chatapi", "method": "POST", "status": "success", "response": openai_response}))



def createlog(prompt, response):
    #create guid
    new_uuid = str(uuid.uuid4())
    timestamp = datetime.datetime.utcnow()
    
    log = { "utcTimeStamp": str(timestamp),  "conversationId" : new_uuid, "prompt" : prompt['gptPrompt'], "userInfo": prompt['userInfo'], "response" : response }
    return log