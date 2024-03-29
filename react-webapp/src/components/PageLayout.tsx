import React from "react";
import Navbar from 'react-bootstrap/Navbar';
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { SignInButton } from "./SignInButton";
import { SignOutButton } from "./SignOutButton";
import Landing from "./Landing";
import { ChatGPTUI } from "./ChatGPTUI";
import config from "../config.json";
import "../styles/pagelayout.css";



export const PageLayout = (props: any) => {
    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();
    

    return (
        <>
           <Navbar bg="dark" variant="dark" fixed="top" expand="lg">
            
                <Navbar.Brand href="/">ChatGPT on Azure</Navbar.Brand>
                <Navbar.Toggle />
                <>
                    { config.UseAADAuth ?
                    <Navbar.Collapse className="justify-content-end">
                        
                        { isAuthenticated ? <SignOutButton accounts={accounts} /> : <SignInButton /> }
                    </Navbar.Collapse>
                    : <></>
                    }
                </>
                
            </Navbar>
            <>
                { config.UseAADAuth ? 
                
                <>
                <AuthenticatedTemplate>
                    {/* 
                        <TestComponent accounts={accounts}/> 
                        <ChatGPTUI accounts={accounts}/>
                    */}
                    <ChatGPTUI accounts={accounts} instance={instance}/>
                    
                </AuthenticatedTemplate>

                <UnauthenticatedTemplate>
                    
                    { config.UseAADAuth ? <Landing/> : <></>}
                    
                </UnauthenticatedTemplate>
                </>
                :
                <UnauthenticatedTemplate>
                    <ChatGPTUI accounts={accounts} instance={instance}/>
                </UnauthenticatedTemplate>
            
            
                }
            </>
            
            
            
            
        </>
    );
};