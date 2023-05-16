import { chatConfig  } from '../config/appConfig'
import { ChatAPIRequest } from './interfaces/iprompt';
import { useMsal } from "@azure/msal-react";
import { user_impersonation_scope } from "../authConfig";

const getAccessToken = (instance: any, accounts : any) => {
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


    return fetch(chatConfig.chatApiEndPoint + "?email=" + apiRequest.userInfo.email, options)
        .then((response: any) => {
            return response.json();
        }).catch((error: any) => {
            console.log(error);
        });
}


export async function fetchChatHistory(apiRequest: ChatAPIRequest, props : any) {
    const accessToken = await getAccessToken(props.instance, props.accounts);
    const bearer = `Bearer ${accessToken}`;
    
    const options = {
        method: "GET",
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
    };


    return fetch(chatConfig.chatApiEndPoint + "?email=" + apiRequest.userInfo.email, options)
        .then((response: any) => {
            return response.json();
        }).catch((error: any) => {
            console.log(error);
        });
}