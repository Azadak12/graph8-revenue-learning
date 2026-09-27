"use client";

import dynamic from "next/dynamic";
import { BrowserRouter } from "react-router-dom";

// The whole product UI is an unmodified client-rendered SPA (react-router-dom
// handles every route below this catch-all). Loaded with ssr:false because it
// reads localStorage and uses browser-only APIs.
const App = dynamic(() => import("../../src/App"), { ssr: false });

export default function CatchAllPage() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
