import requests

messages= [
    {"role": "user", "content": "Find beachfront hotels in San Diego for less than $300 a month with free breakfast."}
]

functions= [  
    {
        "name": "search_hotels",
        "description": "Retrieves hotels from the search index based on the parameters provided",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The location of the hotel (i.e. Seattle, WA)"
                },
                "max_price": {
                    "type": "number",
                    "description": "The maximum price for the hotel"
                },
                "features": {
                    "type": "string",
                    "description": "A comma separated list of features (i.e. beachfront, free wifi, etc.)"
                }
            },
            "required": ["location"],
        },
    }
]  

def add_azure_tag(tagkey, tagvalue):
    # Your application's credentials
    client_id = ""
    client_secret = ""
    tenant_id = ""
    subscription_id = ""    

    # Azure AD OAuth endpoints
    token_endpoint = f"https://login.microsoftonline.com/{tenant_id}/oauth2/token"

    # Request an access token using client credentials grant flow
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "resource": "https://management.azure.com/"
    }

    response = requests.post(token_endpoint, data=data)

    if response.status_code == 200:
        access_token = response.json()["access_token"]

        # Use the access token to make API requests
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        # Example API request
        #api_endpoint = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups?api-version=2021-04-01"
        api_endpoint =  f"https://management.azure.com/subscriptions/{subscription_id}/resourcegroups/fortinet-webapp-rg/providers/Microsoft.Resources/tags/default?api-version=2021-04-01"
        
        tag = {
                "properties": {
                    "tags": {
                        tagkey: tagvalue
                    }
                }
            }
        
        response = requests.put(api_endpoint, headers=headers, json=tag)

        if response.status_code == 200:
            result = response.json()
            return "Tag added successfully"
            # Process the response data as needed
        else:
            return ("API request failed with status code:" + response.status_code)
    else:
        return ("Failed to obtain access token.")