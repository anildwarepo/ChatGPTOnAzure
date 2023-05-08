import { chatConfig  } from '../config/appConfig'
import { ChatAPIRequest } from './interfaces/iprompt';



export async function sendChatMessage(apiRequest: ChatAPIRequest) {
    const headers = new Headers();
    //const bearer = `Bearer ${accessToken}`;

    //headers.append("Authorization", bearer);
    
    const options = {
        method: "POST",
        headers: headers,

        body: JSON.stringify(apiRequest)
    };


    return fetch(chatConfig.chatApiEndPoint + "&email=" + apiRequest.userInfo.email, options)
        .then(response => response.json())
        .catch(error => console.log(error));
}


export async function fetchChatHistory(apiRequest: ChatAPIRequest) {
    const headers = new Headers();
    //const bearer = `Bearer ${accessToken}`;

    //headers.append("Authorization", bearer);
    
    const options = {
        method: "GET",
        headers: headers,
    };


    return fetch(chatConfig.chatApiEndPoint + "&email=" + apiRequest.userInfo.email, options)
        .then(response => response.json())
        .catch(error => console.log(error));
}