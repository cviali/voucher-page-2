import {
  IconDashboard,
  IconDatabase,
  IconUsers,
  IconListDetails,
  IconInnerShadowTop,
  IconHistory,
  IconCreditCard,
  type Icon
} from "@tabler/icons-react"

export type Role = 'admin' | 'cashier' | 'customer';

interface Route {
  title: string;
  url: string;
  icon?: Icon;
  roles: Role[];
}

export const ROUTES: Route[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
    roles: ["admin", "cashier"],
  },
  {
    title: "Manage Vouchers",
    url: "/dashboard/vouchers",
    icon: IconDatabase,
    roles: ["admin"],
  },
  {
    title: "Templates",
    url: "/dashboard/templates",
    icon: IconListDetails,
    roles: ["admin"],
  },
  {
    title: "Customers",
    url: "/dashboard/customers",
    icon: IconUsers,
    roles: ["admin", "cashier"],
  },
  {
    title: "Staff Management",
    url: "/dashboard/staff",
    icon: IconUsers,
    roles: ["admin"],
  },
  {
    title: "Bind Vouchers",
    url: "/dashboard/bind",
    icon: IconListDetails,
    roles: ["cashier", "admin"],
  },
  {
    title: "Approve Claims",
    url: "/dashboard/claims",
    icon: IconInnerShadowTop,
    roles: ["cashier", "admin"],
  },
  {
    title: "Membership",
    url: "/dashboard/membership",
    icon: IconCreditCard,
    roles: ["admin", "cashier"],
  },
  {
    title: "Audit Logs",
    url: "/dashboard/audit",
    icon: IconHistory,
    roles: ["admin"],
  },
]

export const isAuthorized = (role: Role, path: string): boolean => {
  // Always allow public paths
  const publicPaths = ['/login', '/admin/login', '/'];
  if (publicPaths.includes(path)) return true;

  // Customers can't access any dashboard paths
  if (role === 'customer' && path.startsWith('/dashboard')) return false;

  // Non-customers can't access customer portal
  if (role !== 'customer' && path.startsWith('/customer')) return false;

  // Find the most specific route match
  const route = [...ROUTES].reverse().find(r => path === r.url || path.startsWith(r.url + '/'));
  if (!route) return true; // Default to authorized for unknown paths (like login)

  return route.roles.includes(role);
};
