import { ChatAPIRequest } from './interfaces/iprompt';
import { user_impersonation_scope } from "../authConfig";
import config from "../config.json";

const getAccessToken = (instance: any, accounts : any) => {
    if(config.UseAADAuth)
    {
        return new Promise((resolve, reject) => {
            instance.acquireTokenSilent({
                ...user_impersonation_scope,
                account: accounts[0]
            }).then((response: any) => {
                //console.log(response.accessToken);
                resolve(response.accessToken);        
            }).catch((error: any) => {
                reject(error);
            });
        });
    }
    else
    {
        return new Promise((resolve, reject) => {
            resolve("");
        });
    }
}



export async function sendChatMessage(apiRequest: ChatAPIRequest, props : any) {
 
    
    //const headers = new Headers();
    const accessToken = await getAccessToken(props.instance, props.accounts);
    const bearer = `Bearer ${accessToken}`;

    //headers.append("Authorization", bearer);
    //headers.append("Content-Type", "application/json");
    const options = {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
        body: JSON.stringify(apiRequest)
    };


    return fetch(config.CHAT_API_ENDPOINT + "?email=" + apiRequest.userInfo.email, options)
        .then((response: any) => {
            return response.json();
        }).catch((error: any) => {
            return {"api": "send_chat", "method": "POST", "status": "error", "chatHistory": null, "message": error.toString() + " " + config.CHAT_API_ENDPOINT + "\n\n Please check if bot api is running."};
        });
}

export async function fetcheBotApiStatus(props : any) {
    const accessToken = await getAccessToken(props.instance, props.accounts);
    const bearer = `Bearer ${accessToken}`;
    
    const options = {
        method: "GET",
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
    };


    return fetch(config.CHAT_API_STATUS_ENDPOINT, options)
        .then((response: any) => {
            if (response.ok) {
                return response.json(); // Parse the JSON response
            } else {
                throw new Error("error occurred during bot api status check"); // Throw an error for non-OK responses
            }
        })
        .then((data: any) => {
            // Handle the parsed JSON data
            return {"api": "chatapi_status", "method": "GET", "status": "error", "chatHistory": null, "message": data.message};
        }).catch((error: any) => {
            return {"api": "chatapi_status", "method": "GET", "status": "error", "chatHistory": null, "message": error.toString() + " " + config.CHAT_API_STATUS_ENDPOINT + "\n\n Please check if bot api is running."};
            //console.log(error);
        });
}

export async function uploadFile(formData: FormData, props : any) {

    const accessToken = await getAccessToken(props.instance, props.accounts);
    const bearer = `Bearer ${accessToken}`;
    
    const options = {
        method: "POST",
        headers: { 'Authorization': bearer },
        body: formData
    };

    return fetch(config.FILE_UPLOAD_ENDPOINT, options)
    .then((response: any) => {
        if (response.ok) {
            return response.json(); // Parse the JSON response
        } else {
            throw new Error("Could not upload file."); // Throw an error for non-OK responses
        }
    })
    .then((data: any) => {
        // Handle the parsed JSON data
        //const intervalId = setInterval(async () => {
        //    const result = await check_progress(data.entityId, props);
        //    if(result)
        //    {
        //        clearInterval(intervalId);
        //        return {"api": "upload_file", "method": "POST", "status": "success", "chatHistory": result, "message": "File upload is in progress..."};
        //    }
        //  }, 2000);
        return {"api": "upload_file", "method": "POST", "status": "error", "chatHistory": null, "entityId": data.entityId, "message": "File Upload submitted. "};
    })
    //.then((data: any) => {
    //    return {"api": "upload_file", "method": "POST", "status": "success", "chatHistory": data, "message": "File Upload completed."};
    //})
    .catch((error: any) => {
        return {"api": "upload_file", "method": "POST", "status": "error", "chatHistory": null, "message": error.toString() + " " + config.FILE_UPLOAD_ENDPOINT + "\n\n File Upload failed."};
    });
}

export const check_progress  = async (entityId: string, props: any) => {
    if(!entityId){
        return false;
    }
    const accessToken = await getAccessToken(props.instance, props.accounts);
    const bearer = `Bearer ${accessToken}`;
    
    const options = {
        method: "GET",
        headers: { 'Authorization': bearer },
    };

    return fetch(config.FILE_UPLOAD_ENDPOINT_CHECK_PROGRESS + entityId , options)
    .then((response: any) => {
        if (response.ok) {
            return response.json(); // Parse the JSON response
        } else {
            throw new Error("Could not check progress."); // Throw an error for non-OK responses
        }
    })
    .then((data: any) => {
        return data.entity_state;
    })
    .catch((error: any) => {
        return {"api": "check_progress", "method": "GET", "status": "error", "chatHistory": null, "message": error.toString() + " " + config.FILE_UPLOAD_ENDPOINT + "\n\n Could not check file upload progress."};
    });
}

export async function fetchChatHistory(apiRequest: ChatAPIRequest, props : any) {
    const accessToken = await getAccessToken(props.instance, props.accounts);
    const bearer = `Bearer ${accessToken}`;
    
    const options = {
        method: "GET",
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
    };


    return fetch(config.CHAT_API_ENDPOINT + "?email=" + apiRequest.userInfo.email, options)
        .then((response: any) => {
            if (response.ok) {
                return response.json(); // Parse the JSON response
            } else {
                throw new Error("Could not fetch chat history."); // Throw an error for non-OK responses
            }
        })
        .then((data: any) => {
            // Handle the parsed JSON data
            return {"api": "chat_history", "method": "GET", "status": "error", "chatHistory": data, "message": "Feched chat history successfully."};
        }).catch((error: any) => {
            return {"api": "chat_history", "method": "GET", "status": "error", "chatHistory": null, "message": error.toString() + " " + config.CHAT_API_ENDPOINT + "\n\n Please check if bot api is running."};
            //console.log(error);
        });
}