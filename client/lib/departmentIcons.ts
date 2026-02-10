import {
  Building,
  Code,
  PaintBucket,
  Users,
  DollarSign,
  TrendingUp,
  Shield,
  Headphones,
  Truck,
  Settings,
  BookOpen,
  Heart,
  Briefcase,
  Calculator,
  Target,
  Globe,
  Zap,
  Database,
  Monitor,
  Smartphone,
  Camera,
  Music,
  Palette,
  Wrench,
  Award,
  BarChart,
  FileText,
  Mail,
  Phone,
  MessageSquare,
  Search,
  Lock,
  Key,
  Cloud,
  Server,
  Wifi,
  Battery,
  Cpu,
  Printer,
  Scan,
  Download,
  Upload,
  Link,
  Eye,
  Star,
  Flag,
  Gift,
  Calendar,
  Clock,
  Map,
  Compass,
  Home,
} from "lucide-react";

export interface DepartmentIcon {
  id: string;
  name: string;
  icon: any;
  category: string;
}

export const departmentIcons: DepartmentIcon[] = [
  // Technology & Engineering
  { id: "code", name: "Development", icon: Code, category: "Technology" },
  { id: "database", name: "Data", icon: Database, category: "Technology" },
  { id: "monitor", name: "IT Systems", icon: Monitor, category: "Technology" },
  {
    id: "server",
    name: "Infrastructure",
    icon: Server,
    category: "Technology",
  },
  { id: "cloud", name: "Cloud Services", icon: Cloud, category: "Technology" },
  { id: "cpu", name: "Hardware", icon: Cpu, category: "Technology" },
  { id: "wifi", name: "Network", icon: Wifi, category: "Technology" },
  {
    id: "smartphone",
    name: "Mobile",
    icon: Smartphone,
    category: "Technology",
  },
  { id: "settings", name: "DevOps", icon: Settings, category: "Technology" },
  { id: "zap", name: "Innovation", icon: Zap, category: "Technology" },

  // Business & Finance
  { id: "building", name: "Corporate", icon: Building, category: "Business" },
  {
    id: "dollar-sign",
    name: "Finance",
    icon: DollarSign,
    category: "Business",
  },
  { id: "trending-up", name: "Sales", icon: TrendingUp, category: "Business" },
  {
    id: "calculator",
    name: "Accounting",
    icon: Calculator,
    category: "Business",
  },
  { id: "briefcase", name: "Executive", icon: Briefcase, category: "Business" },
  { id: "target", name: "Strategy", icon: Target, category: "Business" },
  { id: "bar-chart", name: "Analytics", icon: BarChart, category: "Business" },
  { id: "award", name: "Performance", icon: Award, category: "Business" },

  // Marketing & Creative
  { id: "palette", name: "Design", icon: Palette, category: "Creative" },
  {
    id: "paint-bucket",
    name: "Branding",
    icon: PaintBucket,
    category: "Creative",
  },
  { id: "camera", name: "Media", icon: Camera, category: "Creative" },
  { id: "music", name: "Audio", icon: Music, category: "Creative" },
  { id: "globe", name: "Marketing", icon: Globe, category: "Creative" },
  { id: "eye", name: "Visual", icon: Eye, category: "Creative" },
  { id: "star", name: "Premium", icon: Star, category: "Creative" },

  // Operations & Support
  { id: "users", name: "Human Resources", icon: Users, category: "Operations" },
  {
    id: "headphones",
    name: "Support",
    icon: Headphones,
    category: "Operations",
  },
  { id: "truck", name: "Logistics", icon: Truck, category: "Operations" },
  { id: "wrench", name: "Maintenance", icon: Wrench, category: "Operations" },
  { id: "shield", name: "Security", icon: Shield, category: "Operations" },
  { id: "lock", name: "Compliance", icon: Lock, category: "Operations" },
  { id: "key", name: "Access Control", icon: Key, category: "Operations" },

  // Communication & Documentation
  {
    id: "file-text",
    name: "Documentation",
    icon: FileText,
    category: "Communication",
  },
  { id: "mail", name: "Email", icon: Mail, category: "Communication" },
  { id: "phone", name: "Call Center", icon: Phone, category: "Communication" },
  {
    id: "message-square",
    name: "Messaging",
    icon: MessageSquare,
    category: "Communication",
  },
  {
    id: "book-open",
    name: "Training",
    icon: BookOpen,
    category: "Communication",
  },

  // Specialized Departments
  { id: "heart", name: "Healthcare", icon: Heart, category: "Specialized" },
  { id: "search", name: "Research", icon: Search, category: "Specialized" },
  { id: "battery", name: "Energy", icon: Battery, category: "Specialized" },
  {
    id: "printer",
    name: "Print Services",
    icon: Printer,
    category: "Specialized",
  },
  { id: "scan", name: "Quality Control", icon: Scan, category: "Specialized" },
  {
    id: "download",
    name: "Procurement",
    icon: Download,
    category: "Specialized",
  },
  { id: "upload", name: "Publishing", icon: Upload, category: "Specialized" },
  { id: "link", name: "Partnerships", icon: Link, category: "Specialized" },
  { id: "gift", name: "Customer Success", icon: Gift, category: "Specialized" },
  { id: "calendar", name: "Events", icon: Calendar, category: "Specialized" },
  {
    id: "clock",
    name: "Project Management",
    icon: Clock,
    category: "Specialized",
  },
  { id: "map", name: "Location Services", icon: Map, category: "Specialized" },
  { id: "compass", name: "Navigation", icon: Compass, category: "Specialized" },
  { id: "home", name: "Facilities", icon: Home, category: "Specialized" },
  { id: "flag", name: "Regional", icon: Flag, category: "Specialized" },
];

export const departmentColors = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#F59E0B", // Orange
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange-600
  "#EC4899", // Pink
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#F59E0B", // Amber
  "#DC2626", // Red-600
  "#7C3AED", // Violet
  "#059669", // Emerald
  "#0EA5E9", // Sky
  "#D97706", // Orange-700
  "#BE185D", // Pink-700
  "#4338CA", // Indigo-700
  "#0D9488", // Teal-600
];

export const departmentShapes = [
  { id: "circle", name: "Circle", preview: "rounded-full" },
  { id: "square", name: "Square", preview: "rounded-none" },
  { id: "hexagon", name: "Hexagon", preview: "rounded-lg" },
  { id: "diamond", name: "Diamond", preview: "rounded-md rotate-45" },
] as const;
