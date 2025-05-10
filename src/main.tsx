import { css, Global } from "@emotion/react";
import { App } from "./App";
import React from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root") as Element).render(
  <>
    <Global
      styles={css`
        @import url('https://fonts.googleapis.com/css2?family=Roboto+Slab&display=swap');

        :root {
          font-family: 'Roboto Slab', sans-serif;
          font-size: 14px;
          line-height: 16px;
          font-weight: 400;
        }

        body {
          margin: 0;
        }
      `}
    />
    <App />
  </>
);
