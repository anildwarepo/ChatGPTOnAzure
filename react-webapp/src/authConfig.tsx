/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from "@azure/msal-browser";
import config from "./config.json";

/**
 * Configuration object to be passed to MSAL instance on creation. 
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md 
 */
export const msalConfig = {
    
    
    
    auth: {
        clientId: config.CLIENT_ID, //"a9495c0c-3b89-4b77-aee4-7cc022380f12",
        authority: `https://login.microsoftonline.com/${config.TENANT_ID}`,  //"https://login.microsoftonline.com/7f1290b4-3c39-4277-a63e-c577680a12cf", //,
        redirectUri: window.location.href //"http://localhost:3000"
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
    system: {	
        loggerOptions: {	
            loggerCallback: (level:any, message:any, containsPii:any) => {	
                if (containsPii) {		
                    return;		
                }		
                switch (level) {		
                    case LogLevel.Error:		
                        console.error(message);		
                        return;		
                    case LogLevel.Info:		
                        console.info(message);		
                        return;		
                    case LogLevel.Verbose:		
                        console.debug(message);		
                        return;		
                    case LogLevel.Warning:		
                        console.warn(message);		
                        return;
                    default:
                        return;		
                }	
            }	
        }	
    }
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit: 
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest = {
    scopes: ["User.Read"]
};


export const user_impersonation_scope = {
    scopes: [config.USER_IMPERSONATIION_SCOPE] //["api://5924b827-87cb-4029-9c51-4481fd427fd5/user_impersonation"]
};

/**
 * Add here the scopes to request when obtaining an access token for MS Graph API. For more information, see:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
};
