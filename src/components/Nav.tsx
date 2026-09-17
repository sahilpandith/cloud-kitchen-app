import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/sales", label: "Sales" },
  { to: "/inventory", label: "Inventory" },
  { to: "/expenses", label: "Expenses" },
  { to: "/profit-loss", label: "P&L" },
  { to: "/insights", label: "Insights" },
  { to: "/settings", label: "Settings" },
];

export default function Nav() {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-orange-200 bg-orange-50 px-4 py-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `whitespace-nowrap text-sm font-medium ${isActive ? "text-orange-700" : "text-gray-600"}`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
