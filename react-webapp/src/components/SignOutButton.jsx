import React, { useState } from "react";
import { useMsal } from "@azure/msal-react";
import DropdownButton from 'react-bootstrap/DropdownButton';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from "react-bootstrap/esm/Dropdown";

/**
 * Renders a sign-out button
 */
export const SignOutButton = (props) => {
    const { instance } = useMsal();
    const [userInfo, setUserInfo] = useState(null);
    const handleLogout = (logoutType) => {
        if (logoutType === "popup") {
            instance.logoutPopup({
                postLogoutRedirectUri: "/",
                mainWindowRedirectUri: "/"
            });
        } else if (logoutType === "redirect") {
            setUserInfo(props.accounts[0]);
            instance.logoutRedirect({
                postLogoutRedirectUri: "/",
            });
        }
    }
    return (
        <>
            
            {userInfo ? 
                <div></div>
                :
                <DropdownButton  as={ButtonGroup} variant="outline-light" drop="start" key="start" id={`dropdown-button-drop-start`}  title={props.accounts[0].name}>
                    <Dropdown.Item  eventKey="1">{props.accounts[0].username}</Dropdown.Item>
                    <Dropdown.Item  eventKey="2" onClick={() => handleLogout("redirect")}>Sign out</Dropdown.Item>
                </DropdownButton>
               
            }
        </>
    );
}