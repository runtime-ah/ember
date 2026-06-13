import {
  Hash,
  Inbox,
  Home,
  Briefcase,
  ShoppingCart,
  Heart,
  DollarSign,
  Plane,
  Lightbulb,
  BookOpen,
  Dumbbell,
  Code2,
  Music,
  Camera,
  Star,
  Calendar,
  Coffee,
  Gift,
  Users,
  Car,
  Utensils,
  Wrench,
  Leaf,
  Target,
  Baby,
  PawPrint,
  Sprout,
  ListTodo,
} from "lucide-react";

// Curated set — distinct, recognizable shapes so projects/sections are easy to
// tell apart at a glance (especially in the collapsed sidebar). The object key
// is what gets stored on the model; keep keys stable.
export const ICONS = {
  inbox: Inbox,
  list: ListTodo,
  home: Home,
  work: Briefcase,
  shopping: ShoppingCart,
  health: Heart,
  money: DollarSign,
  travel: Plane,
  ideas: Lightbulb,
  reading: BookOpen,
  fitness: Dumbbell,
  code: Code2,
  music: Music,
  photo: Camera,
  star: Star,
  calendar: Calendar,
  coffee: Coffee,
  gift: Gift,
  people: Users,
  car: Car,
  food: Utensils,
  tools: Wrench,
  nature: Leaf,
  goals: Target,
  baby: Baby,
  pet: PawPrint,
  garden: Sprout,
};

export const ICON_NAMES = Object.keys(ICONS);

// Render the icon for a stored name, falling back to a hash when unset/unknown.
export function Icon({ name, ...props }) {
  const Cmp = (name && ICONS[name]) || Hash;
  return <Cmp {...props} />;
}
