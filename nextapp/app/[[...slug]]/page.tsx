"use client";

import dynamic from "next/dynamic";

// The whole product UI is an unmodified client-rendered SPA (react-router-dom
// handles every route below this catch-all). The router must live inside the
// ssr:false import: BrowserRouter touches `document` during render.
const ClientRoot = dynamic(() => import("../../src/ClientRoot"), { ssr: false });

export default function CatchAllPage() {
  return <ClientRoot />;
}
