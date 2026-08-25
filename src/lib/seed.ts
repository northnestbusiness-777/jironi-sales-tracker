import { AppState, Category, Property } from "@/types";

export function seedCategories(p: Property): Category[] {
  const pid = p.id;
  const mk = (
    key: string,
    name: string,
    side: Category["side"],
    keywords: string[],
    excludeFromRevenue = false,
  ): Category => ({
    id: `${pid}-${key}`,
    propertyId: pid,
    name,
    side,
    keywords,
    excludeFromRevenue,
  });

  return [
    // ---- Income ----
    mk("room", "Room Sale (Direct)", "income", [
      "room",
      "c/o paid room",
      "paid room",
      "room rent",
    ]),
    mk("ota", "OTA Business", "income", [
      "go mmt",
      "mmt",
      "travelguru",
      "make my trip",
      "agoda",
      "booking.com",
    ]),
    mk("fnb", "Restaurant & Bar Sale", "income", [
      "bar sale",
      "restaurant sale",
      "resturant sale",
      "food sale",
      "f&b",
    ]),
    mk("facility", "Facility / Ancillary Income", "income", [
      "swimming pool",
      "pool",
      "laundry",
      "spa",
      "banquet",
      "hall rent",
    ]),
    mk("damage", "Damage / Penalty Recovery", "income", ["damage"]),
    mk(
      "opening",
      "Opening Balance (non-revenue)",
      "income",
      ["opening balance"],
      true,
    ),
    // ---- Expense ----
    mk("grocery", "Groceries & Kitchen Supplies", "expense", [
      "bread", "ghee", "refined oil", "cooking oil", "poha", "chicken", "egg",
      "garlic", "curd", "cheese", "oats", "drinks", "vegetable", "milk", "rice",
      "flour", "atta", "sugar", "salt", "spice", "masala", "dal", "fruit",
      "meat", "fish", "paneer", "butter", "noodle", "grocery",
    ]),
    mk("bar", "Bar Purchases / Liquor Stock", "expense", [
      "beer", "can beer", "liquor", "wine", "whisky", "whiskey", "vodka",
      "rum", "gin", "tequila",
    ]),
    mk("utility", "Utilities", "expense", [
      "water", "cylinder", "lpg", "electricity", "power", "generator",
    ]),
    mk("transport", "Transport & Fuel", "expense", [
      "auto", "petrol", "rapido", "taxi", "cab", "fare", "diesel", "fuel",
      "transport",
    ]),
    mk("advance", "Staff Salary Advance", "expense", ["salary advance"]),
    mk("welfare", "Staff Welfare", "expense", [
      "staff welfare",
      "welfare",
      "staff tea",
      "staff meal",
      "staff food",
    ]),
    mk("admin", "Admin & Communication", "expense", [
      "mobile recharge", "recharge", "sim", "internet", "wifi", "stationery",
      "xerox", "photocopy", "printing", "courier", "postage",
    ]),
    mk("owner", "Owner/Director Account", "expense", ["md sir"]),
  ];
}

export function seedState(): AppState {
  const jironi: Property = { id: "prop-jironi", name: "Hotel Jironi" };
  const resort: Property = { id: "prop-resort", name: "Jironi Resort" };
  return {
    properties: [jironi, resort],
    categories: [...seedCategories(jironi), ...seedCategories(resort)],
    reports: [],
    entries: [],
    corrections: {},
    apiKey: "",
  };
}