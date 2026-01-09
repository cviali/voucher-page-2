import { 
  IconDashboard, 
  IconDatabase, 
  IconUsers, 
  IconListDetails, 
  IconInnerShadowTop,
  IconHistory
} from "@tabler/icons-react"

export const ROUTES = [
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
    title: "Audit Logs",
    url: "/dashboard/audit",
    icon: IconHistory,
    roles: ["admin"],
  },
]
