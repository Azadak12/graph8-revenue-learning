import { BrowserRouter } from "react-router-dom";
import App from "./App";

export default function ClientRoot() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
