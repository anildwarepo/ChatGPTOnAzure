import React from 'react';
import ReactDOM from 'react-dom/client';
import "bootstrap/dist/css/bootstrap.min.css";
import 'react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css';
import './index.css';
import App from './App';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const msalInstance = new PublicClientApplication(msalConfig);

root.render(
  <>
   <MsalProvider instance={msalInstance}>
            <App />
    </MsalProvider>
  </>
);


