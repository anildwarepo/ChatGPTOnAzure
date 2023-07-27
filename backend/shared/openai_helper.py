import json
import os
import openai
import inspect
import math
from shared import arm_helper

openai.api_type = "azure"
openai.api_version = "2023-07-01-preview"  # SET YOUR API VERSION

DEPLOYMENT_NAME = os.getenv("DEPLOYMENT_NAME")
# helper method used to check if the correct arguments are provided to a function
def check_args(function, args):
    sig = inspect.signature(function)
    params = sig.parameters

    # Check if there are extra arguments
    for name in args:
        if name not in params:
            return False
    # Check if the required arguments are provided 
    for name, param in params.items():
        if param.default is param.empty and name not in args:
            return False

    return True

def calculator(num1, num2, operator):
    if operator == '+':
        return str(num1 + num2)
    elif operator == '-':
        return str(num1 - num2)
    elif operator == '*':
        return str(num1 * num2)
    elif operator == '/':
        return str(num1 / num2)
    elif operator == '**':
        return str(num1 ** num2)
    elif operator == 'sqrt':
        return str(math.sqrt(num1))
    else:
        return "Invalid operator"

def update_azure_tags(tagkey, tagvalue):
    return arm_helper.add_azure_tag(tagkey, tagvalue)

functions = [
        {
            "name": "update_azure_tags",
            "description": "Updates the tags of an Azure resource group given tag key and value",
            "parameters": {
                "type": "object",
                "properties": {
                    "tagkey": {"type": "string"},
                    "tagvalue": {"type": "string"}
                },
                "required": ["tagkey", "tagvalue"],
            },    
        },
        {
            "name": "calculator",
            "description": "A simple calculator used to perform basic arithmetic operations",
            "parameters": {
                "type": "object",
                "properties": {
                    "num1": {"type": "number"},
                    "num2": {"type": "number"},
                    "operator": {"type": "string", "enum": ["+", "-", "*", "/", "**", "sqrt"]},
                },
                "required": ["num1", "num2", "operator"],
            },
        }
    ]

available_functions = {
            "update_azure_tags": update_azure_tags,
            "calculator": calculator,
} 

def call_openai(prompt):
    #openai.api_version = api_version
    #question = {"role":"user", "content":f"Question: {prompt['userQuery']}"} #prompt = {userQuery: userQuery, maxTokens: max_tokens, temperature: temperature, systemMessage: systemMessage}
    #system_message =  {"role": "system", "content": prompt['systemMessage']}
    openai.api_key = os.getenv("OPENAI_API_KEY")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_RESOURCE_ENDPOINT")  # SET YOUR RESOURCE ENDPOINT
    system_message  = prompt['gptPrompt']['systemMessage']
    question = prompt['gptPrompt']['question']
    new_prompt= [system_message] + [question]
    max_response_tokens = int(prompt['maxTokens'])
    
    temperature =  prompt['temperature']
    try:
        response = openai.ChatCompletion.create(
                    engine=DEPLOYMENT_NAME, 
                    messages = new_prompt,
                    temperature=temperature,
                    max_tokens=max_response_tokens,
                    stop=f"Answer:"                
                    )
        return { "llm_response" : response['choices'][0]['message']['content'], "usage" : response.usage }
    except Exception as e:
        return { "llm_response" : e.user_message, "usage" : None } 

def call_openai_with_search(search_prompt, prompt):
    openai.api_key = os.getenv("OPENAI_API_KEY")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_RESOURCE_ENDPOINT")  # SET YOUR RESOURCE ENDPOINT

    max_response_tokens = int(prompt['maxTokens'])    
    temperature =  prompt['temperature']


    function_call_response = ""
    try:
        response = openai.ChatCompletion.create(
                    engine=DEPLOYMENT_NAME, 
                    messages = search_prompt,
                    temperature=temperature,
                    max_tokens=max_response_tokens,
                    functions=functions,
                    function_call="auto", 
                    stop=f"Answer:"                
                    )
        
        if 'function_call' in response['choices'][0]['message']:
            function_name = response['choices'][0]['message']['function_call']['name']
            # verify function exists
            if function_name not in available_functions:
                function_call_response += "Function " + function_name + " does not exist"
            function_to_call = available_functions[function_name]  

            # verify function has correct number of arguments
            function_args = json.loads(response['choices'][0]['message']['function_call']["arguments"])
            if check_args(function_to_call, function_args) is False:
                function_call_response += "Invalid number of arguments for function: " + function_name
            function_response = function_to_call(**function_args)      
            return f"\n\n Functions called:{function_name} \n\n Function Response: {function_response}" , response.usage , True
        else:
            return response['choices'][0]['message']['content'] , response.usage , False
        
    except Exception as e:
        return e.user_message,  None 

def generate_embeddings(text):
    openai.api_key = os.getenv("OPENAI_API_KEY_EMBEDDING")  # SET YOUR OWN API KEY HERE
    openai.api_base = os.getenv("OPENAI_ENDPOINT_EMBEDDING")  # SET YOUR RESOURCE ENDPOINT
    response = openai.Embedding.create(
        input=text, engine="text-embedding-ada-002")
    embeddings = response['data'][0]['embedding']
    return embeddings