import os
import openai

openai.api_type = "azure"
openai.api_key = os.getenv("OPENAI_API_KEY")  # SET YOUR OWN API KEY HERE
openai.api_base = os.getenv("OPENAI_RESOURCE_ENDPOINT")  # SET YOUR RESOURCE ENDPOINT
openai.api_version = os.getenv("OPENAI_API_VERSION")  # SET YOUR API VERSION

DEPLOYMENT_NAME = os.getenv("DEPLOYMENT_NAME")

def call_openai(prompt):
    #openai.api_version = api_version
    #question = {"role":"user", "content":f"Question: {prompt['userQuery']}"} #prompt = {userQuery: userQuery, maxTokens: max_tokens, temperature: temperature, systemMessage: systemMessage}
    #system_message =  {"role": "system", "content": prompt['systemMessage']}
    
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
