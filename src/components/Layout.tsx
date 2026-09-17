import { ReactNode } from "react";
import Nav from "./Nav";
import SyncIndicator from "./SyncIndicator";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <SyncIndicator />
      <main className="p-4">{children}</main>
    </div>
  );
}
